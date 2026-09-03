/* Alterpop — Compare Drawer. Max 2, in-memory only (no persistence between
   sessions). Reads everything off the card's [data-compare-*] attributes, so
   there is never a fetch. Entry point is the `compare` toggle, which only the
   Character / Line pages render. */
(function () {
  class CompareDrawer extends HTMLElement {
    connectedCallback() {
      this.max = parseInt(this.dataset.max, 10) || 2;
      this.items = []; // { id, title, url, image, price, available, manufacturer, weight, dimensions, license }
      this.slots = this.querySelector('[data-compare-slots]');
      this.slotTpl = this.querySelector('[data-compare-slot-template]');
      this.panel = this.querySelector('[data-compare-panel]');
      this.openBtn = this.querySelector('[data-compare-open]');
      this.PENDING = '[ pending ]';

      this.querySelector('[data-compare-clear]').addEventListener('click', () => this.clear());
      this.openBtn.addEventListener('click', () => this.togglePanel(true));
      this.querySelector('[data-compare-close]').addEventListener('click', () => this.togglePanel(false));

      document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-compare-toggle]');
        if (!btn) return;
        e.preventDefault();
        this.toggle(btn);
      });
    }

    read(btn) {
      const d = btn.dataset;
      return {
        id: d.compareId,
        title: d.compareTitle || '',
        url: d.compareUrl || '#',
        image: d.compareImage || '',
        price: d.comparePrice || this.PENDING,
        available: d.compareAvailable === 'true',
        manufacturer: d.compareManufacturer || this.PENDING,
        weight: d.compareWeight || this.PENDING,
        dimensions: d.compareDimensions || this.PENDING,
        license: d.compareLicense || this.PENDING,
      };
    }

    toggle(btn) {
      const id = btn.dataset.compareId;
      const idx = this.items.findIndex((it) => it.id === id);
      if (idx > -1) {
        this.items.splice(idx, 1);
        btn.setAttribute('aria-pressed', 'false');
      } else {
        if (this.items.length >= this.max) {
          // replace the oldest so the toggle always responds
          const dropped = this.items.shift();
          const oldBtn = document.querySelector(`[data-compare-toggle][data-compare-id="${dropped.id}"]`);
          if (oldBtn) oldBtn.setAttribute('aria-pressed', 'false');
        }
        this.items.push(this.read(btn));
        btn.setAttribute('aria-pressed', 'true');
      }
      this.render();
    }

    clear() {
      this.items = [];
      document
        .querySelectorAll('[data-compare-toggle][aria-pressed="true"]')
        .forEach((b) => b.setAttribute('aria-pressed', 'false'));
      this.togglePanel(false);
      this.render();
    }

    togglePanel(open) {
      this.panel.hidden = !open;
      this.classList.toggle('is-open', open);
    }

    render() {
      // bar visibility
      this.hidden = this.items.length === 0;
      if (this.items.length === 0) this.togglePanel(false);

      // slots
      this.slots.textContent = '';
      this.items.forEach((it) => {
        const node = this.slotTpl.content.firstElementChild.cloneNode(true);
        const img = node.querySelector('.ap-compare__slot-img');
        if (it.image) img.src = it.image;
        else img.remove();
        node.querySelector('.ap-compare__slot-title').textContent = it.title;
        node.querySelector('.ap-compare__slot-remove').addEventListener('click', () => {
          const btn = document.querySelector(`[data-compare-toggle][data-compare-id="${it.id}"]`);
          if (btn) this.toggle(btn);
          else {
            this.items = this.items.filter((x) => x.id !== it.id);
            this.render();
          }
        });
        this.slots.appendChild(node);
      });

      this.openBtn.disabled = this.items.length < 2;
      this.openBtn.textContent =
        this.openBtn.textContent.replace(/\s*\(\d+\)\s*$/, '') + ` (${this.items.length})`;

      // table
      const rows = {
        head: (it) => it.title,
        manufacturer: (it) => it.manufacturer,
        weight: (it) => it.weight,
        dimensions: (it) => it.dimensions,
        license: (it) => it.license,
        price: (it) => it.price,
        available: (it) =>
          it.available ? this.txt('in_stock') : this.txt('sold_out'),
      };
      Object.keys(rows).forEach((key) => {
        const tr = this.querySelector(`[data-compare-row="${key}"]`);
        if (!tr) return;
        tr.querySelectorAll('td').forEach((td) => td.remove());
        this.items.forEach((it) => {
          const td = document.createElement('td');
          const val = rows[key](it);
          td.className = key === 'head' ? 'ap-compare__cell-head type-body' : 'ap-compare__cell type-body';
          if (val === this.PENDING) {
            td.innerHTML = '<span class="ap-ph">' + this.PENDING + '</span>';
          } else {
            td.textContent = val;
          }
          tr.appendChild(td);
        });
      });
    }

    txt(k) {
      const map = (window.AP_COMPARE_I18N = window.AP_COMPARE_I18N || {});
      return map[k] || (k === 'in_stock' ? 'In stock' : 'Sold out');
    }
  }

  if (!customElements.get('compare-drawer')) {
    customElements.define('compare-drawer', CompareDrawer);
  }
})();
