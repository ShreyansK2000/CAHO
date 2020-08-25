var EventEmitter = require('events');

/*
 * Global array that keeps track of all game sessions
 */
gamesInSession = [];

/**
 * Game state enum
 */
const gameState = {
  PRE_START: 'pre-start',
  DEAL_CARDS: 'deal-cards',
  SHOW_PROMPT: 'show-prompt',
  AWAIT_RESPONSES: 'await-responses',
  CZAR_SELECT: 'czar-selecting-responses',
  UPDATE_SCORES: 'update-scores',
  CYCLE_CZAR: 'cycle-czar',
  END_GAME: 'end-game'
}

// Fetch the card data from JSON
const jsondata = require('./card_info.json');

/**
 * Class to encapsulate game functionality
 */
class Game {

  /**
   * Constructor for the game session, initialize various parameters
   * Add a reference to the main io object to emit messages to a
   * given room from within the game class
   * @param {socketIO Object} io 
   * @param {string} roomID 
   */
  constructor(room, io) {

    this.ioRef = io;
    this.room = room;

    this.currentCzar = room.creatingUser;

    this.gameState = {
      ioRef: this.ioRef,
      roomID: this.room.roomID,
      currentStateInternal: gameState.PRE_START,
      stateListener: function (val) {},
      set currentState(val) {
        this.currentStateInternal = val;
        this.stateListener(val);
      },
      get currentState() {
        return this.currentStateInternal;
      },
      registerListener: function (listener) {
        this.stateListener = listener;
      }
    }

    this.gameState.registerListener(function (newState) {
      this.ioRef.to(this.roomID).emit('gameStateUpdate', newState);
    });

    this.reqCards = 10;
    this.numWhiteCards = 0;
    this.blackCardIdx = null;

    this.enabledPacks = ["Base", "CAHe1", "CAHe2", "CAHe3", "CAHe4", "CAHe5", "CAHe6"];

    // Set up array objects to track various card information
    this.gamePrompts = [];
    this.gameResponses = [];
    this.currentRoundAnswers = [];

    this.czarDisconnectTimeout = null;

    /*
     * Set up callback function after all users other than the 
     * card czar have submitted a response, send array to czar
     */
    this.submitListener = function () {

      let czarUser = this.room.roomUsers.find(user => user.username === this.currentCzar);
      if (!czarUser) {
        this.startCzarTimer();
        return;
      } else {
        let czarID = czarUser.id;
        this.ioRef.in(czarID).clients((err, clients) => {
          if (clients.length > 0 && err == null) {
            this.ioRef.to(czarID).emit('responsesToBlackCard', this.currentRoundAnswers);
            this.gameState.currentState = gameState.CZAR_SELECT;
            this.currentRoundAnswers = [];
          }
        });
      }
    }

    // Event emitter to start submission callback after collecting all responses
    this.responsesEmitter = new EventEmitter();
    this.responsesEmitter.addListener('allResponsesReceived', this.submitListener.bind(this));

    // TODO add gameState event listener to self so a gameState monitor can be implemented client side
  }

  /**
   * Set up which cards to use in game, and start game with initial hand and prompt
   */
  gameStart() {
    this.gameState.currentState = gameState.PRE_START;

    this.enabledPacks.forEach(packID => {
      this.gamePrompts = this.gamePrompts.concat(jsondata[packID].black);
      this.gameResponses = this.gameResponses.concat(jsondata[packID].white);
    }, this);

    for (var i = 0, value = -1, size = 10, cardIndices = new Array(10); i < size; i++) cardIndices[i] = value;
    // console.log(cardIndices);
    this.room.roomUsers.forEach(user => {
      user.cardIndices = [...cardIndices];
      // console.log(user.cardIndices);
    })
    this.dealWhiteCards();
    this.emitBlackCard();
    this.ioRef.to(this.room.roomID).emit('currentCzar', this.currentCzar);

    this.gameState.currentState = gameState.AWAIT_RESPONSES;
  }

  /**
   * Set up a promise for each user submission that resolves when the last
   * remaining user submits a response card
   */
  async waitResponses() {
    let promise = new Promise((resolve) => {

      setTimeout(() => {
        this.responsesEmitter.on('allResponsesReceived', () => {
          console.log('resolved inside timout block');
          resolve();
        })
      }, 60000);

    });

    await promise;
    return;
  }

  /**
   * Collect the user's specific response and resolve any waiting users 
   * after final user submits a response
   * @param {string} userID 
   * @param {string[]} responseArr
   */
  async gatherResponses(userID, responseArr, responseIndices) {

    this.currentRoundAnswers.forEach(response => {
      // Should never proc due to front-end block but just in case
      if (response.userID === userID) {
        console.log('Response from the same user, will not add to responses');
        return;
      }
    });

    this.currentRoundAnswers.push({
      userID,
      responseArr
    });

    let userIdx = this.room.roomUsers.findIndex(user => user.id === userID);
    if (userIdx !== -1) {
      responseIndices.forEach(indexValue => {
        // console.log(indexValue);
        // console.log(this.room.roomUsers[userIdx].cardIndices[indexValue]);
        this.room.roomUsers[userIdx].cardIndices[indexValue] = -1;
        // console.log(this.room.roomUsers[userIdx].cardIndices[indexValue]);
      })
    }

    this.checkEventTrigger(true)
    // this.currentRoundAnswers.length == this.room.roomUsers.length - 1 ?
    // this.responsesEmitter.emit('allResponsesReceived') : await this.waitResponses();

  }

  async checkEventTrigger(isPrivateCall) {
    this.currentRoundAnswers.length == this.room.roomUsers.length - 1 ?
      this.responsesEmitter.emit('allResponsesReceived') : isPrivateCall ?
      await this.waitResponses() : console.log('continue normal operation');
  }

  /**
   * Emit user and score information to update leaderboard
   */
  updateLocalScores() {
    this.gameState.currentState = gameState.UPDATE_SCORES;
    this.ioRef.to(this.room.roomID).emit('updateScores', this.room.roomUsers);
  }

  /**
   * Select random response cards and deal enough cards to 
   * reach the minimum required cards per hand for each hand
   */
  dealWhiteCards() {
    this.gameState.currentState = gameState.DEAL_CARDS;
    if (this.numWhiteCards < this.reqCards) {
      const cardsToDeal = this.reqCards - this.numWhiteCards;
      const playersToDeal = this.getRoundPlayers(cardsToDeal == this.reqCards);

      playersToDeal.forEach(player => {
        let id = player.id;
        this.ioRef.in(id).clients((err, clients) => {
          if (clients.length > 0 && err == null) {

            while (player.cardIndices.includes(-1)) {
              let randIdx = this.gameResponses[this.getRandomIndex(this.gameResponses.length - 1)];
              if (player.cardIndices.includes(randIdx) || !jsondata.whiteCards[randIdx]) {
                continue;
              } else {
                let replaceIdx = player.cardIndices.indexOf(-1);
                if (replaceIdx !== -1) {
                  player.cardIndices[replaceIdx] = randIdx;
                }
              }
            }

            this.ioRef.to(id).emit('whiteCards', player.cardIndices.map(index => jsondata.whiteCards[index]));
          }
        });
      });
    }
  }

  /**
   * Send randomly selected prompt for current round
   */
  emitBlackCard() {
    this.gameState.currentState = gameState.SHOW_PROMPT;
    this.blackCardIdx = this.gamePrompts[this.getRandomIndex(this.gamePrompts.length - 1)];
    this.numWhiteCards = this.reqCards - jsondata.blackCards[this.blackCardIdx].pick;
    this.ioRef.to(this.room.roomID).emit('blackCard', jsondata.blackCards[this.blackCardIdx]);
  }

  /**
   * Update current cards czar, cycle through current room users
   */
  cycleCzar() {
    this.gameState.currentState = gameState.CYCLE_CZAR;
    let totalLength = this.room.roomUsers.length;
    let newIdx = this.room.roomUsers.findIndex(user => user.username === this.currentCzar) + 1;

    if (newIdx < totalLength) {
      this.currentCzar = this.room.roomUsers[newIdx].username;
    } else if (newIdx === totalLength) {
      this.currentCzar = this.room.roomUsers[0].username;
    }

    this.ioRef.to(this.room.roomID).emit('currentCzar', this.currentCzar);
  }

  /**
   * Change user score information, as indicated by card czar response
   * Operate state machine past the first round
   * @param {Object} winnerObj 
   */
  incrementScore(winnerObj) {
    let user = this.room.roomUsers.find(user => user.id === winnerObj.user)
    user.score++;

    let message = `${user.username} selected the best answer: ${winnerObj.userAns}`
    this.ioRef.to(this.room.roomID).emit('winner', message);

    this.updateLocalScores();
    this.emitBlackCard();
    this.dealWhiteCards();
    this.cycleCzar();

    this.gameState.currentState = gameState.AWAIT_RESPONSES;
  }

  restoreUser(id) {
    const userIdx = this.room.roomUsers.findIndex(user => user.id === id);

    if (userIdx !== -1) {
      const user = this.room.roomUsers[userIdx];

      this.ioRef.to(user.id).emit('whiteCards', user.cardIndices.map(index => jsondata.whiteCards[index]));
      this.ioRef.to(user.id).emit('blackCard', jsondata.blackCards[this.blackCardIdx]);
      this.ioRef.to(user.id).emit('currentCzar', this.currentCzar);
    }
  }

  /**
   * Utility for selecting a bounded random index
   * @param {int} max 
   */
  getRandomIndex(max) {
    return Math.floor(Math.random() * (max + 1));
  }

  /**
   * Utility for selecting room users correctly
   * @param {boolean} condition 
   */
  getRoundPlayers(condition) {
    return condition ? this.room.roomUsers : this.room.roomUsers.filter(user => user.username != this.currentCzar);
  }

  startCzarTimer() {
    console.log('czar has disconnected, starting timer');
    // TODO use setTimeout and clearTimeout to cycle to next czar after a 10 second interval
    this.czarDisconnectTimeout = setTimeout(this.handleCzarDisconnect, 10 * 1000);
  }

  stopCzarTimer() {
    if (this.czarDisconnectTimeout) {
      clearTimeout(this.czarDisconnectTimeout);
      this.handleCzarReconnect();
      this.czarDisconnectTimeout = null;
    }
  }

  handleCzarDisconnect() {
    console.log('timeout worked, update remaining player info');
    // TODO switch to next player in user list. return previous cards if possible
  }

  handleCzarReconnect() {
    console.log('czar reconnected before timeout, see if submissions can be shown');
    // TODO handle a czar rejoining (show submissions etc.)
  }
}

module.exports = {
  gamesInSession,
  Game: Game,
  gameState: gameState
};