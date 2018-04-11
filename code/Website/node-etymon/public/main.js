// This is the main js file of the client side.
// It performs operations like sending an HTTP post request to the server side.

// ADD QUERY MANAGEMENT, OBJECT RECOGNITION MANAGEMENT LIKE IN DOCS

"use strict";
document.addEventListener('DOMContentLoaded', function() {
  var searchWord;
  var cy = window.cy = cytoscape({
    container: document.getElementById('cy')
  });
  function addToGraph(theWord, level) {
    // targetUser
    if (cy.getElementById(theWord.etymology).empty()) {
      cy.add(twitterUserObjToCyEle(theWord, level));
    }
  }

  // submit button interactions
  var submitButton = document.getElementById('submitButton');
  submitButton.addEventListener('click', function() {
          cy.elements().remove();
          var userInput = document.getElementById('wordInput').value;
          console.log(userInput);
          if (userInput) {
                  searchWord = userInput;
          } else {
                  // default value
                  searchWord = 'hello';
          }

      // add the word to the graph
      getWord(searchWord)
        .then(function(then) {
          addToGraph(then.word, 0);
        })
        .catch(function(err) {
          console.log('Could not get data. Error message: ' + err);
        });

  });
});

function getWord(theWord) {
  // send an ajax request
  var wordPromise = $.ajax({
    //change this while running on Google Cloud Platform
    url: 'http://localhost:8080',
    type: 'GET',
    data: { word: theWord }
  });

  return Promise.all(wordPromise)
    .then(function(then) {
      return {
        word: then[0]
      };
    });
}

function twitterUserObjToCyEle(word, level) {
  return {
    data: {
      id: word.etymology
    },
    position: {
      x: -1000000,
      y: -1000000
    }
  };
}
