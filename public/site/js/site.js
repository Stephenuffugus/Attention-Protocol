/**
 * SWS Attention Protocol — Enterprise Sales Site JS
 * - Smooth scroll navigation
 * - SDK running on the page (visitors generate real hashes)
 * - Counter animations
 */
(function() {
  'use strict';

  // Initialize the attention protocol on this page
  if (typeof window.SWSAttention !== 'undefined') {
    SWSAttention.init({
      gameId: 'sws_sales_site',
      debug: false,
      enableBehavioralAnalysis: true
    });
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(function(link) {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      var target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Counter animation for hero stats
  function animateCounters() {
    var counters = document.querySelectorAll('.hs-val');
    counters.forEach(function(counter) {
      var target = parseInt(counter.textContent, 10);
      if (isNaN(target) || target === 0) return;

      var current = 0;
      var step = Math.max(1, Math.floor(target / 40));
      var interval = setInterval(function() {
        current += step;
        if (current >= target) {
          counter.textContent = target;
          clearInterval(interval);
        } else {
          counter.textContent = current;
        }
      }, 30);
    });
  }

  // Intersection Observer for scroll animations
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.step-card, .vert-card, .signal-card, .col-card').forEach(function(el) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      observer.observe(el);
    });
  }

  // Run counter animation on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', animateCounters);
  } else {
    animateCounters();
  }
})();
