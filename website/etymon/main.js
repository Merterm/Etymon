// This is the main js file of the client side.
// It performs operations like sending an HTTP post request to the server side.

// ADD QUERY MANAGEMENT, OBJECT RECOGNITION MANAGEMENT LIKE IN DOCS

"use strict";
document.addEventListener('DOMContentLoaded', function() {
  var searchWord;
  var cy = window.cy = cytoscape({
    container: document.getElementById('cy'),
    //style: 'node { background-color: red; label: data(id);}',
    style: cytoscape.stylesheet()
      .selector('node')
        .css({
          'shape': 'data(faveShape)',
          //'width': 'mapData(weight, 40, 80, 20, 60)',
          'content': 'data(name)',
          'text-valign': 'center',
          'text-outline-width': 2,
          'text-outline-color': 'data(faveColor)',
          'background-color': 'data(faveColor)',
          'color': '#fff'
        })
      .selector('edge')
      .css({
        'opacity': 0.666,
        'width': 'mapData(strength, 70, 100, 2, 6)',
        'target-arrow-shape': 'triangle',
        'source-arrow-shape': 'circle',
        'line-color': 'data(faveColor)',
        'source-arrow-color': 'data(faveColor)',
        'target-arrow-color': 'data(faveColor)'
      })
  });

  // Initialize loading icon
  var loading = document.getElementById('loading');
  loading.classList.add('loaded');
  // Initialize Fade-in cytoscape container
  var cy_container = document.getElementById('cy');
  cy_container.classList.remove('show');

  function addToGraph(query) {
    var nodes = [];
    const TOTAL_NODES_ON_SCREEN = 25;

    //Get the cytoscape element in html
    if (cy.getElementById(query.etymology).empty()) {
      //console.log(theWord);
      if(query.etymology !== null){
        var lines = query.etymology.split('\n');
        // If there are less than TOTAL_NODES_ON_SCREEN nodes, show all of them
        if (lines.length <= TOTAL_NODES_ON_SCREEN) {
          for(var i =0; i < lines.length; i++){
            var columns = lines[i].split('\t');
            // Add the nodes to the network
            if (columns[0] != undefined && columns[0] != ' ' &&
                columns[2] != undefined && columns[2] != ' ') {
                  var source = searchWord.toLowerCase();
                  // Check if the nodes already exist
                  if (nodes.indexOf(columns[0]) === -1) {
                    cy.add(etymToCyNode(source, columns[0]));
                    nodes.push(columns[0]);
                  }
                  if (nodes.indexOf(columns[2]) === -1) {
                    cy.add(etymToCyNode(source, columns[2]));
                    nodes.push(columns[2]);
                  }

                  // Add the edges to the network
                  cy.add(etymToCyEdge(i,columns[0],columns[1],columns[2]));
            }
          }
        }
        // Else show only the important ones
        else {
          for(var i =0; i < lines.length; i++){
            var columns = lines[i].split('\t');
            // Add the nodes to the network
            if (columns[0] != undefined && columns[0] != ' ' &&
                columns[2] != undefined && columns[2] != ' ') {
              if (columns[1] == 'rel:etymology' ||
                  columns[1] == 'rel=etymological_origin_of' ||
                  columns[1] == 'rel=etymologically_related') {
                var source = searchWord.toLowerCase();
                // Check if the nodes already exist
                if (nodes.indexOf(columns[0]) === -1) {
                  cy.add(etymToCyNode(source, columns[0]));
                  nodes.push(columns[0]);
                }
                if (nodes.indexOf(columns[2]) === -1) {
                  cy.add(etymToCyNode(source, columns[2]));
                  nodes.push(columns[2]);
                }

                // Add the edges to the network
                cy.add(etymToCyEdge(i,columns[0],columns[1],columns[2]));
              }
            }
          }
          for(var i =0; i < lines.length && nodes.length < TOTAL_NODES_ON_SCREEN; i++){
            var columns = lines[i].split('\t');
            // Add the nodes to the network
            if (columns[0] != undefined && columns[0] != ' ' &&
                columns[2] != undefined && columns[2] != ' ') {
              var source = searchWord.toLowerCase();
              // Check if the nodes already exist
              if (nodes.indexOf(columns[0]) === -1) {
                cy.add(etymToCyNode(source, columns[0]));
                nodes.push(columns[0]);
              }
              if (nodes.indexOf(columns[2]) === -1) {
                cy.add(etymToCyNode(source, columns[2]));
                nodes.push(columns[2]);
              }

              // Add the edges to the network
              cy.add(etymToCyEdge(i,columns[0],columns[1],columns[2]));
            }
          }
        }
      }

      cy.layout({
        name: 'cose'
      }).run();

      /*cy.nodes().forEach(function(ele) {
        ele.qtip({
          content: {
            text: qtipText(ele, ele.data('id')),
            title: ele.data('name')
          },
          style: {
            classes: 'qtip-bootstrap'
          },
          position: {
            my: 'bottom center',
            at: 'top center',
            target: ele
          }
        });
      });*/
    }

    // Stop the loading icon
    loading.classList.add('loaded');
    cy_container.classList.add('show');
  }

  // Action to perform on tap on nodes
  cy.on('tap', 'node', function (evt) {
      //console.log(evt.target.id());
      var splitted = evt.target.id().split(':');
      var lang = convertISO(splitted[0]);
      var word = splitted[1];
      openNav(word, lang);
      //getWord(word);
  });

  // Search wiktionary for the word
  // Initialize loading icon
  var wiki_loading = document.getElementById('wiki_loading');
  var baseURL = 'http://en.wiktionary.org';
  function showPage(page,text) {
    wiki_loading.classList.add('loaded');
    var sourceurl = baseURL + '/wiki/' + page;
    $('#wikiInfo').html(text);
    $('#sourceurl').attr('href',sourceurl);
    $('#licenseInfo').show();
    // now you can modify content of #wikiInfo as you like
    $('#wikiInfo').find('a:not(.references a):not(.extiw):not([href^="#"])').attr('href',
      function() { return baseURL + $(this).attr('href');
    });
  }

  //Tapping on node opens the sidenav
  function openNav(page, lang) {
    if ($(window).width() >= 800) {
      document.getElementById("mySidenav").style.width = "50%";
      document.getElementById("main").style.marginLeft = "25%";
      //document.body.style.opacity = "0.5";
    } else {
      document.getElementById("mySidenav").style.width = "100%";
    }

    wiki_loading.classList.add('loaded');

    // Query Wiktionary for the word
    $('#pagetitle').text(page);
    $('#jumpBtn').text('Jump to ' + page);
    $('#pagelang').text(lang);
    //Start loading icon
    wiki_loading.classList.remove('loaded');
    $('#wikiInfo').html('Loading Word Information');
    $('#licenseInfo').hide();
    $.getJSON(baseURL+'/w/api.php?action=parse&format=json&prop=text|revid|displaytitle&callback=?&page='+page,
    function(json) {
      if (json.parse != undefined) {
        if(json.parse.revid > 0) {
          showPage(page,json.parse.text['*']);
        } else {
          wiki_loading.classList.add('loaded');
          $('#wikiInfo').html('Word unavailable on Wiktionary');
          $('#licenseInfo').hide();
        }
      }
      else {
        wiki_loading.classList.add('loaded');
        $('#wikiInfo').html('Word unavailable on Wiktionary');
        $('#licenseInfo').hide();
      }
    });
  }

  // Follow-up on a node
  document.getElementById("jumpBtn").addEventListener("click", function(){
    $('[data-ic-class="search-input"]').val(document.getElementById("pagetitle").textContent.substr(1));
    document.getElementById("submitButton").click();
    closeNav();
  });

  // submit button interactions
  var submitButton = document.getElementById('submitButton');

  submitButton.addEventListener('click', function() {
    var userInput = document.getElementById('wordInput').value;
    //console.log(userInput);
    if (userInput) {
      // Hide the etymon title
      var etymon = document.getElementById("etymon");
      if (etymon.style.display !== "none") {
          etymon.style.display = "none";
      }
      cy.elements().remove();
      searchWord = userInput;
      //Start loading icon
      loading.classList.remove('loaded');
      cy_container.classList.remove('show');
      // add the word to the graph
      getWord(searchWord.toLowerCase());
    }
  });

  // hallucinate button interactions
  var hallucinateButton = document.getElementById('hallucinateButton');

  hallucinateButton.addEventListener('click', function() {
    var userInput = document.getElementById('hallucinateInput').value;
    //console.log(userInput);
    if (userInput) {
      // Hide the etymon title
      var etymon = document.getElementById("etymon");
      if (etymon.style.display !== "none") {
          etymon.style.display = "none";
      }
      cy.elements().remove();
      searchWord = userInput;
      //Start loading icon
      loading.classList.remove('loaded');
      cy_container.classList.remove('show');
      // add the word to the graph
      getHallucination(searchWord.toLowerCase());
    }
  });

  //Requests the word from the server
  function getWord(theWord) {
    // send an ajax request
    var response = $.ajax({
      //change this while running on Google Cloud Platform
      url: 'https://etymon-190009.appspot.com/search',
      //url: 'http://localhost:8080/search',
      type: 'POST',
      data: { word: theWord },
      success: function(response){
        //console.log(response);
        addToGraph(response);
      }
    });
  }

  //Requests hallucination from the server
  function getHallucination(theWord) {
    // send an ajax request
    var response = $.ajax({
      //change this while running on Google Cloud Platform
      url: 'http://localhost:8080/lstm',
      type: 'POST',
      data: { word: theWord },
      success: function(response){
        //console.log(response);
        addToGraph(response);
      }
    });
  }

  //Transforms etymological word data to cytoscape node
  function etymToCyNode(sourceNode, theWord) {
    var splitted = theWord.split(':');
    var lang = convertISO(splitted[0]);
    var word = splitted[1];

    var faveColor = '#6FB1FC';
    var faveShape = 'ellipse';

    /*var str = new String(sourceNode);
    if (str.toString().localCompare(word)==0) {
      console.log(sourceNode + " " + word);
      faveColor = '#86B342';
      faveShape = 'barrel';
    }*/

    return {
      data: {
        id: theWord,
        name: word,
        faveColor : faveColor,
        faveShape: faveShape
      }
    };
  }

  //Transforms etymological relation data to cytoscape edge
  function etymToCyEdge(id, sourceWord, rel, targetWord) {
    //console.log(rel);
    var faveColor = '#6FB1FC';
    var strength = 70;
    if (rel == "rel:etymology") {
      faveColor = '#EDA1ED';
      strength = 100;
    }
    else if (rel == "rel:etymologically_related") {
      faveColor = '#86B342';
      strength = 90;
    }
    else if (rel == "rel:etymological_origin_of") {
      faveColor = '#1047BD';
      strength = 90;
    }
    return {
      data: {
        id: id,
        source: sourceWord,
        target: targetWord,
        faveColor: faveColor,
        strength: strength
      }
    };
  }

  /*
  // qTip box function
  function qtipText(node, theWord) {
    // send an ajax request
    var response = $.ajax({
      //change this while running on Google Cloud Platform
      url: 'https://glosbe.com/gapi/translate?from=pol&dest=eng&format=json&phrase=witaj&pretty=true&tm=true',
      datatype: 'jsonp',
      success: function(response){
        console.log(response);
      }
    });
    var splitted = theWord.split(':');
    var lang = convertISO(splitted[0]);
    return lang
  }*/

  //Converts the given ISO 639-2 codes to regular language names
  function convertISO(lang) {
    switch(lang) {
      case "aar":
        return "Afar";
        break;
      case "ara":
        return "Arabic";
        break;
      case "ang":
        return "Old English";
        break;
      case "ben":
        return "Bengali";
        break;
      case "bul":
        return "Bulgarian";
        break;
      case "cat":
        return "Catalan";
        break;
      case "ces":
        return "Czech";
        break;
      case "dan":
        return "Danish";
        break;
      case "deu":
        return "German";
        break;
      case "dum":
        return "Middle Dutch";
        break;
      case "egy":
        return "Ancient Egyptian";
        break;
      case "eng":
        return "English";
        break;
      case "enm":
        return "Middle English";
        break;
      case "epo":
        return "Esperanto";
        break;
      case "est":
        return "Estonian";
        break;
      case "fil":
        return "Filipino";
        break;
      case "fin":
        return "Finnish"
        break;
      case "fra":
        return "French";
        break;
      case "fre":
        return "French";
        break;
      case "frm":
        return "Middle French";
        break;
      case "fro":
        return "Old French";
        break;
      case "gem":
        return "Germanic Languages";
        break;
      case "gml":
        return "Middle Low German";
        break;
      case "kat":
        return "Georgian";
        break;
      case "gla":
        return "Scottish Gaelic";
        break;
      case "gle":
        return "Irish";
        break;
      case "gmh":
        return "Middle High German";
        break;
      case "goh":
        return "Old High German";
        break;
      case "got":
        return "Gothic";
        break;
      case "grc":
        return "Ancient Greek";
        break;
      case "ell":
        return "Greek";
        break;
      case "gsw":
        return "Swiss German";
        break;
      case "hat":
        return "Haitian";
        break;
      case "haw":
        return "Hawaiian";
        break;
      case "hbs":
        return "Serbo-Croatian";
        break;
      case "heb":
        return "Hebrew";
        break;
      case "hin":
        return "Hindi";
        break;
      case "hit":
        return "Hittite";
        break;
      case "hrv":
        return "Croatian";
        break;
      case "hun":
        return "Hungarian";
        break;
      case "ice":
        return "Icelandic";
        break;
      case "ina":
        return "Interlingua";
        break;
      case "inc":
        return "Indic";
        break;
      case "ine":
        return "Indo-European";
        break;
      case "ira":
        return "Iranian Languages";
        break;
      case "iro":
        return "Iraquoian Languages";
        break;
      case "ita":
        return "Italian";
        break;
      case "jav":
        return "Javanese";
        break;
      case "jap":
        return "Japanese";
        break;
      case "jpn":
        return "Japanese";
        break;
      case "kaz":
        return "Kazakh";
        break;
      case "kir":
        return "Kyrgyz";
        break;
      case "kon":
        return "Kongo";
        break;
      case "kor":
        return "Korean";
        break;
      case "kur":
        return "Kurdish";
        break;
      case "lat":
        return "Latin";
        break;
      case "lav":
        return "Latvian";
        break;
      case "lit":
        return "Lithuanian";
        break;
      case "ltz":
        return "Luxembourgish";
        break;
      case "mkd":
        return "Macedonian";
        break;
      case "mac":
        return "Macedonian";
        break;
      case "map":
        return "Austronesian Languages";
        break;
      case "mga":
        return "Middle Irish";
        break;
      case "mon":
        return "Mongolian";
        break;
      case "mlt":
        return "Maltese";
        break;
      case "nds":
        return "Low German";
        break;
      case "nep":
        return "Nepali";
        break;
      case "nld":
        return "Dutch";
        break;
      case "nno":
        return "Norwegian Nynorsk";
        break;
      case "nob":
        return "Norwegian Bokmål";
        break;
      case "non":
        return "Old Norse";
        break;
      case "nor":
        return "Norwegian";
        break;
      case "odt":
        return "Old Dutch";
        break;
      case "oss":
        return "Ossetian";
        break;
      case "ota":
        return "Ottoman Turkish";
        break;
      case "peo":
        return "Old Persian";
        break;
      case "fas":
        return "Persian";
        break;
      case "phi":
        return "Philippine languages";
        break;
      case "phn":
        return "Phoenician";
        break;
      case "pol":
        return "Polish";
        break;
      case "por":
        return "Portuguese";
        break;
      case "pro":
        return "Old Provençal";
        break;
      case "roa":
        return "Romance languages";
        break;
      case "roh":
        return "Romansh";
        break;
      case "ron":
        return "Romanian";
        break;
      case "rom":
        return "Romany";
        break;
      case "rus":
        return "Russian";
        break;
      case "sai":
        return "South American Indian";
        break;
      case "san":
        return "Sanskrit";
        break;
      case "sem":
        return "Semitic Languages";
        break;
      case "sga":
        return "Old Irish";
        break;
      case "sit":
        return "Sino-Tibetan Languages";
        break;
      case "sla":
        return "Slavic Languages";
        break;
      case "slk":
        return "Slovak";
        break;
      case "slv":
        return "Slovenian";
        break;
      case "smi":
        return "Sami Languages";
        break;
      case "spa":
        return "Spanish"
        break;
      case "srd":
        return "Sardinian";
        break;
      case "srp":
        return "Serbian";
        break;
      case "sux":
        return "Sumerian";
        break;
      case "swa":
        return "Swahili";
        break;
      case "swe":
        return "Swedish";
        break;
      case "syc":
        return "Classical Syriac";
        break;
      case "syr":
        return "Syriac";
        break;
      case "tai":
        return "Tai Languages";
        break;
      case "tgk":
        return "Tajik";
        break;
      case "tgl":
        return "Tagalog";
        break;
      case "thai":
        return "Thai";
        break;
      case "bod":
        return "Tibetan";
        break;
      case "tuk":
        return "Turkmen";
        break;
      case "tur":
        return "Turkish";
        break;
      case "tut":
        return "Altaic Languages";
        break;
      case "uig":
        return "Uyghur";
        break;
      case "ukr":
        return "Ukrainian";
        break;
      case "urd":
        return "Urdu";
        break;
      case "uzb":
        return "Uzbek";
        break;
      case "vie":
        return "Vietnamese";
        break;
      case "cym":
        return "Welsh";
        break;
      case "yid":
        return "Yiddish";
        break;
      default:
        return lang;
      }
  }
});
