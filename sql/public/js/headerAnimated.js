$(document).ready(function() {
    $(".navbar-brand").hover(
      function() {
        $(this).css("color", "coral");
      },
      function() {
        $(this).css("color", "white");
      }
    );
  });