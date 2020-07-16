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
const jsondata = require('./test.json');
// const { json } = require('body-parser');

const reqCards = 10;
const maxWhiteCards = jsondata.whiteCards.length;

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

    this.responsesEmitter = new EventEmitter();
  }

  /**
   * Add a reference to the main io object to emit messages to a
   * given room from within the game class
   * @param {socketIO Object} io 
   * @param {string} roomID 
   */
  addServerRef() {
    this.emitBlackCard(jsondata.blackCards[13]);
    this.dealWhiteCards();
    this.setNewCzar(this.currentCzar);
    // this.attachSubmissionListeners();
  }

  /**
   * Change the text for the black card
   * @param {string} text 
   */
  emitBlackCard(text) {
    this.ioRef.to(this.room.roomID).emit('blackCard', text);
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
              whiteCardIndices.push(getRandomIndex(maxWhiteCards - 1));
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

  setNewCzar(czarName) {
    this.ioRef.to(this.room.roomID).emit('newCzar', czarName);
  }
}

module.exports = {
  gamesInSession,
  Game: Game,
  gameState: gameState
};