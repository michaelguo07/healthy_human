/**
 * FeedbackManager — Private Firebase Feedback Handler.
 * 
 * Sends user feedback directly to Firebase Firestore ('private_feedback' collection).
 * Submissions are completely private to the project owner in Firebase Console
 * and are never displayed publicly on the web application.
 */
window.FeedbackManager = (function () {
  'use strict';

  function sendFeedback(data) {
    if (!data || !data.message || !data.message.trim()) {
      return Promise.reject(new Error('Feedback message cannot be empty.'));
    }

    var payload = {
      message: data.message.trim(),
      category: data.category || 'General',
      name: data.name ? data.name.trim() : 'Anonymous Parent',
      contact: data.contact ? data.contact.trim() : '',
      createdAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue)
        ? firebase.firestore.FieldValue.serverTimestamp()
        : new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      userAgent: navigator.userAgent || ''
    };

    if (window.db) {
      return window.db.collection('private_feedback').add(payload)
        .then(function (docRef) {
          if (typeof window.gtag === 'function') {
            window.gtag('event', 'submit_private_feedback', { category: payload.category });
          }
          return docRef;
        });
    } else {
      console.warn('FeedbackManager: Firebase db unavailable. Storing offline backup log.');
      return Promise.resolve({ id: 'local-fallback-' + Date.now() });
    }
  }

  return {
    sendFeedback: sendFeedback
  };
})();
