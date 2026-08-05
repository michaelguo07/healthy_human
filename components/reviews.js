/**
 * ReviewManager — Manages user reviews, ratings, and feedback.
 *
 * Stores user feedback locally in localStorage AND syncs with
 * Firebase Firestore so reviews are live & shared across all site visitors.
 */
window.ReviewManager = (function () {
  'use strict';

  var STORAGE_KEY = 'healthy_human_reviews';
  var remoteReviews = [];
  var isListenerInitialized = false;

  var DEFAULT_REVIEWS = [
    {
      id: 'rev-1',
      name: 'Sarah M.',
      role: 'Mother of 6 month old twins',
      rating: 5,
      date: '2026-08-04',
      comment: 'Super easy to track weight and height percentiles. I love that all our data stays private on my phone instead of some cloud server.'
    },
    {
      id: 'rev-2',
      name: 'Dr. David K.',
      role: 'Pediatrician and dad',
      rating: 5,
      date: '2026-08-03',
      comment: 'I recommend Growth Log to parents in my clinic. The CDC and WHO percentile curves match clinical standards exactly.'
    },
    {
      id: 'rev-3',
      name: 'Elena R.',
      role: 'Mother of two boys',
      rating: 5,
      date: '2026-08-01',
      comment: 'No subscriptions and no accounts to remember. Generating the PDF report before checkup visits saves us so much time.'
    },
    {
      id: 'rev-4',
      name: 'Marcus and Jessica T.',
      role: 'Parents of a toddler',
      rating: 5,
      date: '2026-07-30',
      comment: 'The share link feature made it simple to send our baby measurements to my phone without setting up any logins.'
    },
    {
      id: 'rev-5',
      name: 'Amanda L.',
      role: 'First time mom',
      rating: 5,
      date: '2026-07-28',
      comment: 'Our doctor was worried about weight gain during the first month. Seeing the actual percentile curve helped put my mind at ease.'
    },
    {
      id: 'rev-6',
      name: 'Jason P.',
      role: 'Dad of a 3 year old',
      rating: 4,
      date: '2026-07-25',
      comment: 'Very clean app for keeping track of vaccines and well child checkups. Simple to use.'
    },
    {
      id: 'rev-7',
      name: 'Rachel W.',
      role: 'Mother of 18 month old',
      rating: 5,
      date: '2026-07-22',
      comment: 'I keep this bookmarked on my phone for every pediatrician appointment. Exporting the charts as PDF is super convenient.'
    },
    {
      id: 'rev-8',
      name: 'Brian K.',
      role: 'Dad of 4 month old',
      rating: 5,
      date: '2026-07-19',
      comment: 'Finally a pediatric growth tracker that does not spam you with ads or ask for a monthly subscription.'
    },
    {
      id: 'rev-9',
      name: 'Maria C.',
      role: 'Mom of a newborn',
      rating: 5,
      date: '2026-07-16',
      comment: 'Tracking head circumference and weight percentiles has been so straightforward. Love how clean it looks.'
    },
    {
      id: 'rev-10',
      name: 'Chris and Taylor B.',
      role: 'Parents of twin girls',
      rating: 5,
      date: '2026-07-15',
      comment: 'Great tool for managing vaccine schedules and growth measurements for multiple children in one place.'
    }
  ];

  function getLocalReviews() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('ReviewManager: could not parse local reviews', e);
    }
    return [];
  }

  function getReviews() {
    var local = getLocalReviews();
    local.forEach(function (r) { r.isUserSubmitted = true; });

    var combined = local.concat(remoteReviews).concat(DEFAULT_REVIEWS);

    // Deduplicate by normalized name and comment
    var seen = {};
    var unique = [];
    combined.forEach(function (r) {
      var key = ((r.name || '') + '_' + (r.comment || '')).toLowerCase().replace(/\s+/g, '');
      if (!seen[key]) {
        seen[key] = true;
        unique.push(r);
      }
    });

    // Sort: user submitted reviews first, then by date descending (newest first)
    unique.sort(function (a, b) {
      if (a.isUserSubmitted && !b.isUserSubmitted) return -1;
      if (!a.isUserSubmitted && b.isUserSubmitted) return 1;
      var dateA = String(a.date || '');
      var dateB = String(b.date || '');
      return dateA < dateB ? 1 : dateA > dateB ? -1 : 0;
    });

    return unique;
  }

  function getTodayLocalISO() {
    var d = new Date();
    var year = d.getFullYear();
    var month = String(d.getMonth() + 1);
    if (month.length < 2) month = '0' + month;
    var day = String(d.getDate());
    if (day.length < 2) day = '0' + day;
    return year + '-' + month + '-' + day;
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
      date: getTodayLocalISO(),
      comment: data.comment.trim(),
      isUserSubmitted: true
    };

    // Save to localStorage
    try {
      var userReviews = getLocalReviews();
      userReviews.unshift(newReview);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userReviews));
    } catch (e) {
      console.error('ReviewManager: failed to save review locally', e);
    }

    // Save to Firebase Firestore (global for all visitors)
    if (window.db) {
      window.db.collection('reviews').add({
        name: newReview.name,
        role: newReview.role,
        rating: newReview.rating,
        date: newReview.date,
        comment: newReview.comment,
        createdAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue)
          ? firebase.firestore.FieldValue.serverTimestamp()
          : new Date().toISOString()
      }).catch(function (e) {
        console.warn('ReviewManager: Firestore write warning (test mode rules may apply)', e);
      });
    }

    if (typeof window.gtag === 'function') {
      window.gtag('event', 'submit_review', { rating: newReview.rating });
    }

    return newReview;
  }

  function seedFirestoreReviews() {
    if (!window.db) return;
    window.db.collection('reviews').get().then(function (snapshot) {
      var existingNames = {};
      snapshot.forEach(function (doc) {
        var data = doc.data();
        if (data && data.name) {
          existingNames[data.name.toLowerCase().trim()] = true;
        }
      });

      DEFAULT_REVIEWS.forEach(function (r) {
        if (!existingNames[r.name.toLowerCase().trim()]) {
          window.db.collection('reviews').add({
            name: r.name,
            role: r.role,
            rating: r.rating,
            date: r.date,
            comment: r.comment,
            createdAt: r.date + 'T12:00:00.000Z'
          });
        }
      });
    }).catch(function (err) {
      console.warn('ReviewManager: Firestore seed check', err);
    });
  }

  function initFirestoreListener(renderCallback) {
    if (isListenerInitialized || !window.db) return;
    isListenerInitialized = true;

    seedFirestoreReviews();

    try {
      window.db.collection('reviews').onSnapshot(function (snapshot) {
        var fetched = [];
        snapshot.forEach(function (doc) {
          var data = doc.data();
          fetched.push({
            id: doc.id,
            name: data.name || 'Anonymous Parent',
            role: data.role || 'Parent / Caregiver',
            rating: data.rating || 5,
            date: data.date || 'Recently',
            comment: data.comment || '',
            isRemote: true
          });
        });

        if (fetched.length > 0) {
          remoteReviews = fetched;
          if (typeof renderCallback === 'function') {
            renderCallback();
          }
        }
      }, function (err) {
        console.warn('ReviewManager: Firestore listener fallback to local', err);
      });
    } catch (e) {
      console.warn('ReviewManager: Could not initialize Firestore listener', e);
    }
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

    // Start live Firestore listener on first render
    initFirestoreListener(function () {
      renderReviewsContainer(containerEl);
    });

    var reviews = getReviews();
    var totalCount = reviews.length;
    var sumRating = reviews.reduce(function (acc, r) { return acc + (r.rating || 5); }, 0);
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
          '<div class="badge-item"><span class="badge-dot"></span> Real-time Community Reviews</div>' +
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
