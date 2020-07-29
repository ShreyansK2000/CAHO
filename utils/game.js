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
      this.ioRef.in(czarID).clients((err, clients) => {
        if (clients.length > 0 && err == null) {
          this.ioRef.to(czarID).emit('responsesToBlackCard', this.currentRoundAnswers);
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
  gameStart() {
    this.gameState = gameState.PRE_START;
    
    this.enabledPacks.forEach(packID => {
      this.gamePrompts = this.gamePrompts.concat(jsondata[packID].black);
      this.gameResponses = this.gameResponses.concat(jsondata[packID].white);
    }, this);

    this.dealWhiteCards();
    this.emitBlackCard();
    this.ioRef.to(this.room.roomID).emit('newCzar', this.currentCzar);
    
    this.gameState = gameState.AWAIT_RESPONSES;
  }

  async waitResponses () {
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

  async gatherResponses (userID, responseArr) {
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

    this.currentRoundAnswers.length == this.room.roomUsers.length - 1 ?
     this.responsesEmitter.emit('allResponsesReceived') : await this.waitResponses();

    

  }

  getRoundPlayers (condition) {
    return condition ? this.room.roomUsers : this.room.roomUsers.filter(user => user.username != this.currentCzar);
  }

  updateLocalScores() {
    this.gameState = gameState.UPDATE_SCORES;
    this.ioRef.to(this.room.roomID).emit('updateScores', this.room.roomUsers);
  }

  dealWhiteCards() {
    this.gameState = gameState.DEAL_CARDS;
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
  
  /**
   * Change the text for the black card
   * @param {string} text 
   */
  emitBlackCard() {
    this.gameState = gameState.SHOW_PROMPT;
    let newBlackCardIdx = this.gamePrompts[getRandomIndex(this.gamePrompts.length - 1)];
    this.numWhiteCards = reqCards - jsondata.blackCards[newBlackCardIdx].pick;
    this.ioRef.to(this.room.roomID).emit('blackCard', jsondata.blackCards[newBlackCardIdx]);
  }

  cycleCzar() {
    this.gameState = gameState.CYCLE_CZAR;
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
    this.emitBlackCard();
    this.dealWhiteCards();
    this.cycleCzar();

    this.gameState = gameState.AWAIT_RESPONSES;
  }

  
}

module.exports = {
  gamesInSession,
  Game: Game,
  gameState: gameState
};