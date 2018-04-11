// This is the main js file of the client side.
// It performs operations like sending an HTTP post request to the server side.

// ADD QUERY MANAGEMENT, OBJECT RECOGNITION MANAGEMENT LIKE IN DOCS

"use strict";
document.addEventListener('DOMContentLoaded', function() {
  var searchWord;
  var cy = window.cy = cytoscape({
    container: document.getElementById('cy'),
    style: 'node { background-color: red; label: data(id);}'
  });

  // Initialize loading icon
  var loading = document.getElementById('loading');
  loading.classList.add('loaded');

  function addToGraph(theWord) {
    var nodes = [];
    if (cy.getElementById(theWord.etymology).empty()) {
      console.log(theWord);
      if(theWord.etymology !== null){
        var lines = theWord.etymology.split('\n');
        for(var i =0; i < lines.length; i++){
          var columns = lines[i].split('\t');
          // Add the nodes to the network
          console.log(columns[0]);
          console.log(columns[2]);
          if (columns[0] != undefined && columns[0] != ' ' &&
              columns[2] != undefined && columns[2] != ' ') {
                cy.add(etymToCyNode(columns[0]));
                cy.add(etymToCyNode(columns[2]));
                // Add the edges to the network
                cy.add(etymToCyEdge(columns[0],i,columns[2]));
          }
        }
      }
      cy.layout({
        name: 'cose'
      }).run();
    }

    // Stop the loading icon
    loading.classList.add('loaded');
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

    //Start loading icon
    loading.classList.remove('loaded');
    // add the word to the graph
    getWord(searchWord);
  });

  //Requests the word from the server
  function getWord(theWord) {
    // send an ajax request
    var response = $.ajax({
      //change this while running on Google Cloud Platform
      url: 'http://localhost:8080',
      type: 'POST',
      data: { word: theWord },
      success: function(response){
        //console.log(response);
        addToGraph(response);
      }
    });
  }

  //Transforms etymological word data to cytoscape node
  function etymToCyNode(theWord) {
    //console.log(theWord)
    return {
      data: {
        id: theWord
      }
    };
  }

  //Transforms etymological relation data to cytoscape edge
  function etymToCyEdge(sourceWord, rel, targetWord) {
    //console.log(theWord)
    return {
      data: {
        id: rel,
        source: sourceWord,
        target: targetWord
      }
    };
  }
});
