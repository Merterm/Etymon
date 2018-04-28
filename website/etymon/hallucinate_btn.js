$(document).ready(function(){

  var $hallucinateTrigger = $('[data-ic-class="hallucinate-trigger"]'),
      $hallucinateInput = $('[data-ic-class="hallucinate-input"]'),
      $hallucinateClear = $('[data-ic-class="hallucinate-clear"]');

  $hallucinateTrigger.click(function(){

    var $this = $('[data-ic-class="hallucinate-trigger"]');
    $this.addClass('active');
    $hallucinateInput.focus();

  });

  $hallucinateInput.blur(function(){

    if($hallucinateInput.val().length > 0){

      return false;

    } else {

      $hallucinateTrigger.removeClass('active');

    }

  });

  $hallucinateClear.click(function(){
    $hallucinateInput.val('');
  });

  $hallucinateInput.focus(function(){
    $hallucinateTrigger.addClass('active');
  });

  var input = document.getElementById("hallucinateInput");

  // Execute a function when the user releases a key on the keyboard
  input.addEventListener("keyup", function(event) {
    // Cancel the default action, if needed
    event.preventDefault();
    // Number 13 is the "Enter" key on the keyboard
    if (event.keyCode === 13) {
      // Trigger the button element with a click
      document.getElementById("hallucinateButton").click();
    }
  });

});
