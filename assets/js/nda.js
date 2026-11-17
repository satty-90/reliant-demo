/* NDA agreement pop-up (all pages except Home, which has its own in home-form.js). */
document.addEventListener('DOMContentLoaded', function() {
      const ndaCheckbox = document.getElementById('nda');
      const ndaModal = document.getElementById('ndaModal');
      const ndaAgreeBtn = document.getElementById('ndaAgreeBtn');
      const ndaCancelBtn = document.getElementById('ndaCancelBtn');
      const ndaModalClose = document.getElementById('ndaModalClose');

      if (ndaCheckbox && ndaModal) {
        // Intercept checkbox click
        ndaCheckbox.addEventListener('click', function(e) {
          if (this.checked) {
            // Prevent immediate checking until agreed in modal
            e.preventDefault();
            ndaModal.classList.remove('hidden');
          }
        });

        function closeModal(agreed) {
          ndaModal.classList.add('hidden');
          ndaCheckbox.checked = agreed;
        }

        if (ndaAgreeBtn) ndaAgreeBtn.addEventListener('click', function() { closeModal(true); });
        if (ndaCancelBtn) ndaCancelBtn.addEventListener('click', function() { closeModal(false); });
        if (ndaModalClose) ndaModalClose.addEventListener('click', function() { closeModal(false); });
      }
    });
