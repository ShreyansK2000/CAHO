var EventEmitter = require('events');
gamesInSession = [];
/**
 * Game state enum
 */
const gameState = {
  PRE_START: 'pre-start',
  DEAL_CARDS: 'deal-cards',
  SHOW_PROMPT: 'show-prompt',
  AWAIT_RESPONSES: 'await-responses',
  UPDATE_SCORES: 'update-scores',
  CYCLE_CZAR: 'cycle-czar',
  END_GAME: 'end-game'
}
const jsondata = require('./card_info.json');

const reqCards = 10;
function getRandomIndex(max) {
  return Math.floor(Math.random() * (max + 1));
}

/**
 * Class to encapsulate game functionality
 */
class Game {
  constructor(room, io) {

    this.ioRef = io;
    this.room = room;
    // console.log(this.room);

    this.currentCzar = room.creatingUser;
    this.currentBlackCard = null;
    this.state = gameState.PRE_START;
    this.numWhiteCards = 0;
    this.gameState = gameState.AWAIT_RESPONSES;

    this.currentRoundAnswers = [];

    this.enabledPacks = ["Base", "CAHe1", "CAHe2", "CAHe3", "CAHe4", "CAHe5", "CAHe6"];
    this.maxBlackCards = 0;
    this.maxWhiteCards = 0;
    
    this.responsesEmitter = new EventEmitter();

    this.gamePrompts = [];
    this.gameResponses = [];

    this.submitListener = function() {

      let czarID = this.room.roomUsers.find(user => user.username === this.currentCzar).id;
      console.log(czarID)
      this.ioRef.in(czarID).clients((err, clients) => {
        if (clients.length > 0 && err == null) {
          this.ioRef.to(czarID).emit('responsesToBlackCard', this.currentRoundAnswers);
          this.dealWhiteCards();
          this.currentRoundAnswers = [];
        }
      });
    }

    this.responsesEmitter.addListener('allResponsesReceived', this.submitListener.bind(this));
  }

  /**
   * Add a reference to the main io object to emit messages to a
   * given room from within the game class
   * @param {socketIO Object} io 
   * @param {string} roomID 
   */
  addServerRef() {
    this.ioRef.to(this.room.roomID).emit('newCzar', this.currentCzar);
    this.enabledPacks.forEach(packID => {
      this.gamePrompts = this.gamePrompts.concat(jsondata[packID].black);
      this.gameResponses = this.gameResponses.concat(jsondata[packID].white);
    }, this);
    this.emitBlackCard();
    this.dealWhiteCards();
  }

  /**
   * Change the text for the black card
   * @param {string} text 
   */
  emitBlackCard() {
    console.log(this.gamePrompts.length);
    let newBlackCardIdx = this.gamePrompts[getRandomIndex(this.gamePrompts.length - 1)];
    console.log(newBlackCardIdx);
    this.ioRef.to(this.room.roomID).emit('blackCard', jsondata.blackCards[newBlackCardIdx]);
  }

  dealWhiteCards() {
    if (this.numWhiteCards < reqCards) {
      const cardsToDeal = reqCards - this.numWhiteCards;
      const playersToDeal = this.getRoundPlayers(cardsToDeal == reqCards);

      playersToDeal.forEach(player => {
        let id = player.id;
        this.ioRef.in(id).clients((err, clients) => {
          if (clients.length > 0 && err == null) {
            let whiteCardIndices = [];
            
            for (let i = 0; i < cardsToDeal; i++) {
              whiteCardIndices.push(this.gameResponses[getRandomIndex(this.gameResponses.length - 1)]);
            }

            let whiteCardsToSend = whiteCardIndices.map(index => jsondata.whiteCards[index]);
            this.ioRef.to(id).emit('newWhiteCards', whiteCardsToSend);
          }
        });
      });
    }
  }

  async waitResponses () {
    let promise = new Promise((resolve) => {
      console.log('in the promise')
           
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

  async gatherResponses (userID, responseArr) {
    this.currentRoundAnswers.push({
      userID, 
      responseArr
    });

    console.log(this.currentRoundAnswers)

    if (this.currentRoundAnswers.length == this.room.roomUsers.length - 1) {
      this.responsesEmitter.emit('allResponsesReceived');
      console.log('Emitted resolved, only remaining user');
    } else {
      await this.waitResponses();
      console.log('resolved');
    }
    console.log('returning');

  }

  getRoundPlayers (condition) {
    return condition ? this.room.roomUsers : this.room.roomUsers.filter(user => user.username != this.currentCzar);
  }

  setNewCzar() {
    let totalLength = this.room.roomUsers.length;
    let newIdx = this.room.roomUsers.findIndex(user => user.username === this.currentCzar) + 1;

    if (newIdx < totalLength) {
      this.currentCzar = this.room.roomUsers[newIdx].username;
    } else if (newIdx === totalLength) {
      this.currentCzar = this.room.roomUsers[0].username;
    }

    this.ioRef.to(this.room.roomID).emit('newCzar', this.currentCzar);

  }

  incrementScore (winnerObj) {
    let user = this.room.roomUsers.find(user => user.id === winnerObj.user)
    user.score++;

    let message = `${user.username} selected the best answer: ${winnerObj.userAns}`
    this.ioRef.to(this.room.roomID).emit('winner', message);

    this.updateLocalScores();
  }

  updateLocalScores() {
    this.ioRef.to(this.room.roomID).emit('updateScores', this.room.roomUsers);
    this.setNewCzar();
    this.emitBlackCard()
  }
}

module.exports = {
  gamesInSession,
  Game: Game,
  gameState: gameState
};