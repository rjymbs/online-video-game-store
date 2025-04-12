$(document).ready(function() {
    $(".btn-animated").on("click", function(e) {
      var x = e.clientX - $(this).offset().left;
      var y = e.clientY - $(this).offset().top;
  
      $(this).find("::after").css({
        top: y + "px",
        left: x + "px"
      });
  
      // Добавляем переход на другую страницу
      window.location.href = $(this).parent().attr("href");
    });
  });