$(document).ready(function(){

  var $searchTrigger = $('[data-ic-class="search-trigger"]'),
      $searchInput = $('[data-ic-class="search-input"]'),
      $searchClear = $('[data-ic-class="search-clear"]');

  $searchTrigger.click(function(){

    var $this = $('[data-ic-class="search-trigger"]');
    $this.addClass('active');
    $searchInput.focus();

  });

  $searchInput.blur(function(){

    if($searchInput.val().length > 0){

      return false;

    } else {

      $searchTrigger.removeClass('active');

    }

  });

  $searchClear.click(function(){
    $searchInput.val('');
  });

  $searchInput.focus(function(){
    $searchTrigger.addClass('active');
  });

  // Get the input field
  var input = document.getElementById("wordInput");

  // Execute a function when the user releases a key on the keyboard
  input.addEventListener("keyup", function(event) {
    // Cancel the default action, if needed
    event.preventDefault();
    // Number 13 is the "Enter" key on the keyboard
    if (event.keyCode === 13) {
      // Trigger the button element with a click
      document.getElementById("submitButton").click();
    }
  });

});
