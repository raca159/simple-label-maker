// Simple Label Maker - Frontend Application

class LabelMaker {
  constructor() {
    this.currentSampleId = null;
    this.samples = [];
    this.uiSchema = null;
    this.projectInfo = null;
    this.annotations = {};
    
    this.init();
  }

  async init() {
    try {
      // Load project info and UI schema
      await Promise.all([
        this.loadProjectInfo(),
        this.loadUISchema(),
        this.loadSamples()
      ]);

      // Set up event listeners
      this.setupEventListeners();

      // Get current sample from URL or load first sample
      const pathMatch = window.location.pathname.match(/\/label\/(.+)/);
      if (pathMatch) {
        await this.loadSample(pathMatch[1]);
      } else if (this.samples.length > 0) {
        await this.loadSample(this.samples[0].id);
      }

      // Load saved annotations from localStorage
      this.loadSavedAnnotations();

    } catch (error) {
      console.error('Failed to initialize:', error);
      this.showToast('Failed to initialize application', 'error');
    }
  }

  async loadProjectInfo() {
    const response = await fetch('/api/project');
    this.projectInfo = await response.json();
    
    document.getElementById('projectName').textContent = this.projectInfo.projectName;
    document.getElementById('projectDescription').textContent = 
      this.projectInfo.description || 'No description provided.';
  }

  async loadUISchema() {
    const response = await fetch('/api/ui-schema');
    this.uiSchema = await response.json();
    
    document.getElementById('labelingTitle').textContent = 
      this.uiSchema.labelingInterface.title || 'Labels';
  }

  async loadSamples() {
    const response = await fetch('/api/samples');
    this.samples = await response.json();
    this.updateProgress();
  }

  async loadSample(sampleId) {
    this.currentSampleId = sampleId;
    
    // Update URL
    window.history.pushState({}, '', `/label/${sampleId}`);
    
    // Show loading state
    const dataContent = document.getElementById('dataContent');
    dataContent.innerHTML = `
      <div class="loading-placeholder">
        <div class="spinner"></div>
        <p>Loading sample...</p>
      </div>
    `;

    try {
      // Load sample data
      const dataResponse = await fetch(`/api/samples/${sampleId}/data`);
      const sampleData = await dataResponse.json();
      
      // Render sample based on type
      this.renderSampleData(sampleData);
      
      // Update sample ID display
      document.getElementById('sampleId').textContent = sampleId;
      
      // Render labeling interface
      this.renderLabelingInterface();
      
      // Load existing annotation for this sample
      this.loadAnnotationForSample(sampleId);
      
      // Update navigation
      await this.updateNavigation();
      
    } catch (error) {
      console.error('Failed to load sample:', error);
      dataContent.innerHTML = `
        <div class="loading-placeholder">
          <p>Failed to load sample</p>
        </div>
      `;
    }
  }

  renderSampleData(sampleData) {
    const dataContent = document.getElementById('dataContent');
    
    if (sampleData.type === 'image') {
      dataContent.innerHTML = `<img src="${sampleData.url}" alt="Sample image" />`;
    } else if (sampleData.type === 'text') {
      dataContent.innerHTML = `<div class="text-content">${this.escapeHtml(sampleData.content)}</div>`;
    } else if (sampleData.type === 'audio') {
      dataContent.innerHTML = `<audio controls src="${sampleData.url}"></audio>`;
    } else if (sampleData.type === 'video') {
      dataContent.innerHTML = `<video controls src="${sampleData.url}"></video>`;
    }
  }

  renderLabelingInterface() {
    const container = document.getElementById('labelingInterface');
    const labels = this.uiSchema.labelingInterface.labels;
    
    container.innerHTML = '';
    
    labels.forEach(label => {
      const labelGroup = document.createElement('div');
      labelGroup.className = 'label-group';
      labelGroup.dataset.labelName = label.name;
      
      // Title
      const title = document.createElement('div');
      title.className = 'label-group-title';
      title.innerHTML = `
        ${label.name}
        ${label.required ? '<span class="required-badge">Required</span>' : ''}
      `;
      labelGroup.appendChild(title);
      
      // Render based on type
      switch (label.type) {
        case 'choices':
        case 'classification':
          labelGroup.appendChild(this.renderChoices(label));
          break;
        case 'rating':
          labelGroup.appendChild(this.renderRating(label));
          break;
        case 'text-input':
          labelGroup.appendChild(this.renderTextInput(label));
          break;
        default:
          labelGroup.appendChild(this.renderChoices(label));
      }
      
      container.appendChild(labelGroup);
    });
  }

  renderChoices(label) {
    const container = document.createElement('div');
    container.className = 'choices-container';
    
    const inputType = label.multiSelect ? 'checkbox' : 'radio';
    
    (label.options || []).forEach(option => {
      const optionDiv = document.createElement('div');
      optionDiv.className = 'choice-option';
      optionDiv.dataset.value = option.value;
      
      optionDiv.innerHTML = `
        <input type="${inputType}" name="${label.name}" value="${option.value}" />
        ${option.color ? `<span class="choice-color" style="background-color: ${option.color}"></span>` : ''}
        <span class="choice-label">${option.label}</span>
        ${option.hotkey ? `<span class="choice-hotkey">${option.hotkey}</span>` : ''}
      `;
      
      optionDiv.addEventListener('click', () => {
        if (label.multiSelect) {
          optionDiv.classList.toggle('selected');
          optionDiv.querySelector('input').checked = optionDiv.classList.contains('selected');
        } else {
          container.querySelectorAll('.choice-option').forEach(el => el.classList.remove('selected'));
          optionDiv.classList.add('selected');
          optionDiv.querySelector('input').checked = true;
        }
      });
      
      container.appendChild(optionDiv);
    });
    
    return container;
  }

  renderRating(label) {
    const container = document.createElement('div');
    container.className = 'rating-container';
    container.dataset.labelName = label.name;
    
    const min = label.min || 1;
    const max = label.max || 5;
    
    for (let i = min; i <= max; i++) {
      const star = document.createElement('span');
      star.className = 'rating-star';
      star.dataset.value = i;
      star.textContent = '★';
      
      star.addEventListener('click', () => {
        container.querySelectorAll('.rating-star').forEach((s, index) => {
          s.classList.toggle('active', index < i);
        });
        container.dataset.value = i;
      });
      
      star.addEventListener('mouseenter', () => {
        container.querySelectorAll('.rating-star').forEach((s, index) => {
          s.style.color = index < i ? '#f59e0b' : '';
        });
      });
      
      star.addEventListener('mouseleave', () => {
        container.querySelectorAll('.rating-star').forEach((s, index) => {
          s.style.color = '';
        });
      });
      
      container.appendChild(star);
    }
    
    return container;
  }

  renderTextInput(label) {
    const container = document.createElement('div');
    container.className = 'text-input-container';
    
    const textarea = document.createElement('textarea');
    textarea.name = label.name;
    textarea.placeholder = `Enter ${label.name}...`;
    
    container.appendChild(textarea);
    return container;
  }

  collectLabels() {
    const labels = {};
    const labelGroups = document.querySelectorAll('.label-group');
    
    labelGroups.forEach(group => {
      const labelName = group.dataset.labelName;
      
      // Check for choices
      const selectedChoices = group.querySelectorAll('.choice-option.selected');
      if (selectedChoices.length > 0) {
        const values = Array.from(selectedChoices).map(el => el.dataset.value);
        labels[labelName] = values.length === 1 ? values[0] : values;
      }
      
      // Check for rating
      const ratingContainer = group.querySelector('.rating-container');
      if (ratingContainer && ratingContainer.dataset.value) {
        labels[labelName] = parseInt(ratingContainer.dataset.value);
      }
      
      // Check for text input
      const textarea = group.querySelector('textarea');
      if (textarea && textarea.value.trim()) {
        labels[labelName] = textarea.value.trim();
      }
    });
    
    return labels;
  }

  validateLabels(labels) {
    const requiredLabels = this.uiSchema.labelingInterface.labels
      .filter(l => l.required)
      .map(l => l.name);
    
    const missingLabels = requiredLabels.filter(name => !labels[name]);
    
    return {
      valid: missingLabels.length === 0,
      missing: missingLabels
    };
  }

  async submitAnnotation() {
    const labels = this.collectLabels();
    const validation = this.validateLabels(labels);
    
    if (!validation.valid) {
      this.showToast(`Missing required labels: ${validation.missing.join(', ')}`, 'warning');
      return;
    }

    try {
      const response = await fetch('/api/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sampleId: this.currentSampleId,
          labels: labels,
          status: 'submitted'
        })
      });

      if (response.ok) {
        // Save to localStorage
        this.saveAnnotationLocally(this.currentSampleId, labels);
        this.showToast('Annotation submitted successfully!', 'success');
        this.updateProgress();
        
        // Move to next sample
        const navInfo = await this.getNavigationInfo();
        if (navInfo.hasNext) {
          this.loadSample(navInfo.nextId);
        }
      } else {
        throw new Error('Failed to submit');
      }
    } catch (error) {
      console.error('Submit error:', error);
      this.showToast('Failed to submit annotation', 'error');
    }
  }

  saveAnnotationLocally(sampleId, labels) {
    this.annotations[sampleId] = labels;
    localStorage.setItem('labelmaker_annotations', JSON.stringify(this.annotations));
  }

  loadSavedAnnotations() {
    try {
      const saved = localStorage.getItem('labelmaker_annotations');
      if (saved) {
        this.annotations = JSON.parse(saved);
      }
    } catch (e) {
      this.annotations = {};
    }
  }

  loadAnnotationForSample(sampleId) {
    const savedLabels = this.annotations[sampleId];
    if (!savedLabels) return;
    
    // Restore saved labels
    Object.entries(savedLabels).forEach(([labelName, value]) => {
      const group = document.querySelector(`[data-label-name="${labelName}"]`);
      if (!group) return;
      
      // Restore choices
      if (typeof value === 'string' || Array.isArray(value)) {
        const values = Array.isArray(value) ? value : [value];
        values.forEach(v => {
          const option = group.querySelector(`[data-value="${v}"]`);
          if (option) {
            option.classList.add('selected');
            option.querySelector('input').checked = true;
          }
        });
      }
      
      // Restore rating
      if (typeof value === 'number') {
        const ratingContainer = group.querySelector('.rating-container');
        if (ratingContainer) {
          ratingContainer.dataset.value = value;
          ratingContainer.querySelectorAll('.rating-star').forEach((s, index) => {
            s.classList.toggle('active', index < value);
          });
        }
      }
      
      // Restore text
      const textarea = group.querySelector('textarea');
      if (textarea && typeof value === 'string') {
        textarea.value = value;
      }
    });
  }

  async getNavigationInfo() {
    const response = await fetch(`/api/navigation/${this.currentSampleId}`);
    return await response.json();
  }

  async updateNavigation() {
    const navInfo = await this.getNavigationInfo();
    
    document.getElementById('prevBtn').disabled = !navInfo.hasPrevious;
    document.getElementById('nextBtn').disabled = !navInfo.hasNext;
    
    document.getElementById('prevBtn').onclick = () => {
      if (navInfo.previousId) this.loadSample(navInfo.previousId);
    };
    
    document.getElementById('nextBtn').onclick = () => {
      if (navInfo.nextId) this.loadSample(navInfo.nextId);
    };
  }

  updateProgress() {
    const totalSamples = this.samples.length;
    const annotatedSamples = Object.keys(this.annotations).length;
    const percentage = totalSamples > 0 ? (annotatedSamples / totalSamples) * 100 : 0;
    
    document.getElementById('progressText').textContent = `${annotatedSamples} / ${totalSamples}`;
    document.getElementById('progressFill').style.width = `${percentage}%`;
  }

  setupEventListeners() {
    // Submit button
    document.getElementById('submitBtn').addEventListener('click', () => {
      this.submitAnnotation();
    });

    // Skip button
    document.getElementById('skipBtn').addEventListener('click', async () => {
      const navInfo = await this.getNavigationInfo();
      if (navInfo.hasNext) {
        this.loadSample(navInfo.nextId);
      }
    });

    // Instructions toggle
    document.getElementById('toggleInstructions').addEventListener('click', () => {
      const content = document.getElementById('instructionsContent');
      const btn = document.getElementById('toggleInstructions');
      content.classList.toggle('collapsed');
      btn.textContent = content.classList.contains('collapsed') ? '+' : '−';
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Don't handle shortcuts when typing in textarea
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      
      // Number keys for hotkeys
      if (e.key >= '1' && e.key <= '9') {
        const option = document.querySelector(`[data-label-name] .choice-hotkey`);
        if (option) {
          const allOptions = document.querySelectorAll('.choice-option .choice-hotkey');
          allOptions.forEach(hotkeyEl => {
            if (hotkeyEl.textContent === e.key) {
              hotkeyEl.closest('.choice-option').click();
            }
          });
        }
      }
      
      // Enter to submit
      if (e.key === 'Enter' && e.ctrlKey) {
        this.submitAnnotation();
      }
      
      // Arrow keys for navigation
      if (e.key === 'ArrowLeft' && e.altKey) {
        document.getElementById('prevBtn').click();
      }
      if (e.key === 'ArrowRight' && e.altKey) {
        document.getElementById('nextBtn').click();
      }
    });
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  window.labelMaker = new LabelMaker();
});
