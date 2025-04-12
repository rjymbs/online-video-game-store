$(document).ready(function() {
    $('input[name="slide"]').on('change', function() {
      $('.card_sets').removeClass('active');
      $('label[for="' + this.id + '"]').addClass('active');

      $('.description_sets').stop().animate({
        opacity: 0,
        transform: 'translateY(30px)'
      }, 300, function() {
        $(this).css({
          opacity: 1,
          transform: 'translateY(0)'
        });
      });
    });
  });