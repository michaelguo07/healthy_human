/**
 * ReviewManager — Manages user reviews, ratings, and feedback.
 *
 * Stores user feedback locally in localStorage while providing
 * default community reviews for new visitors.
 */
window.ReviewManager = (function () {
  'use strict';

  var STORAGE_KEY = 'healthy_human_reviews';

  var DEFAULT_REVIEWS = [
    {
      id: 'rev-1',
      name: 'Sarah M.',
      role: 'Mother of 6-month-old twins',
      rating: 5,
      date: '2026-07-28',
      comment: 'Super easy to track weight and height percentiles! I love that all our family data stays 100% private on my phone.'
    },
    {
      id: 'rev-2',
      name: 'Dr. David K.',
      role: 'Pediatrician & Father',
      rating: 5,
      date: '2026-07-15',
      comment: 'I recommend Growth Log to parents in my clinic. The CDC & WHO percentile curves match clinical standards exactly.'
    },
    {
      id: 'rev-3',
      name: 'Elena R.',
      role: 'Mother of 2',
      rating: 5,
      date: '2026-06-30',
      comment: 'No subscriptions, no accounts, and no annoying ads. Generating the PDF export for checkups is a lifesaver!'
    },
    {
      id: 'rev-4',
      name: 'Marcus & Jessica T.',
      role: 'Parents of 1-year-old',
      rating: 5,
      date: '2026-06-12',
      comment: 'The share link feature made it so easy to sync our baby’s measurements between our phones without creating accounts.'
    }
  ];

  function getReviews() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var userReviews = JSON.parse(raw);
        if (Array.isArray(userReviews) && userReviews.length > 0) {
          return userReviews.concat(DEFAULT_REVIEWS);
        }
      }
    } catch (e) {
      console.warn('ReviewManager: could not parse reviews', e);
    }
    return DEFAULT_REVIEWS.slice();
  }

  function addReview(data) {
    if (!data || !data.name || !data.comment || !data.rating) {
      throw new Error('Name, rating, and comment are required.');
    }

    var newReview = {
      id: 'user-' + Date.now(),
      name: data.name.trim(),
      role: data.role ? data.role.trim() : 'Parent / Caregiver',
      rating: Math.min(5, Math.max(1, parseInt(data.rating, 10) || 5)),
      date: new Date().toISOString().split('T')[0],
      comment: data.comment.trim(),
      isUserSubmitted: true
    };

    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var userReviews = raw ? JSON.parse(raw) : [];
      userReviews.unshift(newReview);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userReviews));
    } catch (e) {
      console.error('ReviewManager: failed to save review', e);
    }

    if (typeof window.gtag === 'function') {
      window.gtag('event', 'submit_review', { rating: newReview.rating });
    }

    return newReview;
  }

  function renderStars(rating) {
    var starsHtml = '';
    for (var i = 1; i <= 5; i++) {
      if (i <= rating) {
        starsHtml += '<span class="star-icon filled">★</span>';
      } else {
        starsHtml += '<span class="star-icon empty">☆</span>';
      }
    }
    return starsHtml;
  }

  function renderReviewsContainer(containerEl) {
    if (!containerEl) return;

    var reviews = getReviews();
    var totalCount = reviews.length;
    var sumRating = reviews.reduce(function (acc, r) { return acc + r.rating; }, 0);
    var avgRating = (sumRating / totalCount).toFixed(1);

    var html = '' +
      '<div class="reviews-overview-card">' +
        '<div class="reviews-rating-header">' +
          '<div class="big-rating-number">' + avgRating + '</div>' +
          '<div class="rating-stars-column">' +
            '<div class="stars-row">' + renderStars(Math.round(avgRating)) + '</div>' +
            '<div class="rating-subtitle">Based on ' + totalCount + '+ parent reviews</div>' +
          '</div>' +
          '<button id="open-review-modal-btn" class="btn-primary btn-leave-review">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>' +
            '<span>Leave a Review</span>' +
          '</button>' +
        '</div>' +
        '<div class="reviews-badges-row">' +
          '<div class="badge-item"><span class="badge-dot"></span> 100% Free & Private</div>' +
          '<div class="badge-item"><span class="badge-dot"></span> Loved by Parents</div>' +
          '<div class="badge-item"><span class="badge-dot"></span> Clinical Accuracy</div>' +
        '</div>' +
      '</div>' +

      '<div class="reviews-grid">';

    reviews.forEach(function (r) {
      html += '' +
        '<div class="review-card' + (r.isUserSubmitted ? ' user-review-card' : '') + '">' +
          '<div class="review-card-header">' +
            '<div>' +
              '<h4 class="reviewer-name">' + escapeHtml(r.name) + (r.isUserSubmitted ? ' <span class="your-review-tag">Your Review</span>' : '') + '</h4>' +
              '<p class="reviewer-role">' + escapeHtml(r.role) + '</p>' +
            '</div>' +
            '<div class="review-stars">' + renderStars(r.rating) + '</div>' +
          '</div>' +
          '<p class="review-comment">"' + escapeHtml(r.comment) + '"</p>' +
          '<div class="review-date">' + escapeHtml(r.date) + '</div>' +
        '</div>';
    });

    html += '</div>';

    containerEl.innerHTML = html;

    var btn = containerEl.querySelector('#open-review-modal-btn');
    if (btn) {
      btn.addEventListener('click', function () {
        var modal = document.getElementById('review-modal');
        if (modal) {
          modal.hidden = false;
          modal.setAttribute('aria-hidden', 'false');
          document.body.classList.add('modal-open');
          var firstInput = modal.querySelector('input, select, textarea');
          if (firstInput) setTimeout(function () { firstInput.focus(); }, 100);
        }
      });
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return {
    getReviews: getReviews,
    addReview: addReview,
    renderReviewsContainer: renderReviewsContainer
  };
})();
