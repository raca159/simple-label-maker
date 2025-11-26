// Simple Label Maker - Frontend Application

class LabelMaker {
  constructor() {
    this.currentSampleId = null;
    this.samples = [];
    this.uiSchema = null;
    this.projectInfo = null;
    this.annotations = {};
    this.currentSeriesData = null;
    this.timeSeriesCharts = [];
    
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
    } else if (sampleData.type === 'time-series') {
      // Store series data for later rendering
      this.currentSeriesData = sampleData.seriesData;
      dataContent.innerHTML = '<div class="time-series-placeholder">Time series data loaded. See charts below.</div>';
    }
  }

  renderLabelingInterface() {
    const container = document.getElementById('labelingInterface');
    const labels = this.uiSchema.labelingInterface.labels;
    
    container.innerHTML = '';
    
    // Destroy any existing charts
    if (this.timeSeriesCharts) {
      this.timeSeriesCharts.forEach(chart => chart.destroy());
    }
    this.timeSeriesCharts = [];
    
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
        case 'time-series':
          labelGroup.appendChild(this.renderTimeSeries(label));
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

  renderTimeSeries(label) {
    const container = document.createElement('div');
    container.className = 'time-series-container';
    container.dataset.labelName = label.name;
    
    const seriesData = this.currentSeriesData || [];
    const seriesCount = label.count || seriesData.length || 10;
    const seriesOptions = label.seriesOptions || [
      { value: 'AF', label: 'AF', color: '#FF5733' },
      { value: 'Noise', label: 'Noise', color: '#FFC300' },
      { value: 'None', label: 'None', color: '#C0C0C0' }
    ];
    const globalOptions = label.globalOptions || [
      { value: 'AF', label: 'AF', color: '#FF5733' },
      { value: 'nonAF', label: 'Non-AF', color: '#33FF57' }
    ];
    const axisConfig = label.axis || {};

    // Render individual series charts with label controls
    for (let i = 0; i < seriesCount; i++) {
      const seriesItem = document.createElement('div');
      seriesItem.className = 'series-item';
      seriesItem.dataset.seriesIndex = i;

      // Series header
      const seriesHeader = document.createElement('div');
      seriesHeader.className = 'series-header';
      seriesHeader.innerHTML = `<span class="series-label">Series ${i + 1}</span>`;

      // Series label selector
      const selectContainer = document.createElement('div');
      selectContainer.className = 'series-select-container';
      const select = document.createElement('select');
      select.className = 'series-select';
      select.dataset.seriesIndex = i;
      select.innerHTML = seriesOptions.map(opt => 
        `<option value="${opt.value}" style="color: ${opt.color || '#000'}">${opt.label}</option>`
      ).join('');
      selectContainer.appendChild(select);
      seriesHeader.appendChild(selectContainer);
      seriesItem.appendChild(seriesHeader);

      // Chart canvas
      const chartContainer = document.createElement('div');
      chartContainer.className = 'chart-container';
      const canvas = document.createElement('canvas');
      canvas.id = `chart-${label.name}-${i}`;
      canvas.className = 'series-chart';
      chartContainer.appendChild(canvas);
      seriesItem.appendChild(chartContainer);

      container.appendChild(seriesItem);

      // Render chart with data
      const data = seriesData[i] || this.generateDemoSeriesData();
      this.renderSeriesChart(canvas, data, i, axisConfig);
    }

    // Global classification section
    const globalSection = document.createElement('div');
    globalSection.className = 'global-classification-section';
    
    const globalTitle = document.createElement('div');
    globalTitle.className = 'global-title';
    globalTitle.textContent = label.globalLabel || 'Sample Classification';
    globalSection.appendChild(globalTitle);

    const globalOptionsContainer = document.createElement('div');
    globalOptionsContainer.className = 'global-options';
    globalOptions.forEach((opt, idx) => {
      const radioLabel = document.createElement('label');
      radioLabel.className = 'global-option';
      radioLabel.innerHTML = `
        <input type="radio" name="global-${label.name}" value="${opt.value}" />
        <span class="global-option-label" style="background-color: ${opt.color || '#ddd'}">${opt.label}</span>
        ${opt.hotkey ? `<span class="choice-hotkey">${opt.hotkey}</span>` : ''}
      `;
      globalOptionsContainer.appendChild(radioLabel);
    });
    globalSection.appendChild(globalOptionsContainer);
    container.appendChild(globalSection);

    // Comment section
    const commentSection = document.createElement('div');
    commentSection.className = 'comment-section';
    
    const commentTitle = document.createElement('div');
    commentTitle.className = 'comment-title';
    commentTitle.textContent = label.commentLabel || 'Comments/Observations';
    commentSection.appendChild(commentTitle);

    const commentTextarea = document.createElement('textarea');
    commentTextarea.className = 'comment-textarea';
    commentTextarea.name = `comment-${label.name}`;
    commentTextarea.placeholder = 'Enter your observations...';
    commentSection.appendChild(commentTextarea);
    
    container.appendChild(commentSection);

    return container;
  }

  generateDemoSeriesData() {
    const data = [];
    for (let j = 0; j < 100; j++) {
      data.push(Math.sin(j * 0.1) * 0.5 + (Math.random() - 0.5) * 0.2);
    }
    return data;
  }

  renderSeriesChart(canvas, data, seriesIndex, axisConfig) {
    // Check if Chart.js is available
    if (typeof Chart === 'undefined') {
      // Fallback: render a simple canvas visualization
      this.renderSimpleChart(canvas, data, axisConfig);
      return;
    }

    const ctx = canvas.getContext('2d');
    const labels = data.map((_, i) => i);
    
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: `Series ${seriesIndex + 1}`,
          data: data,
          borderColor: '#4f46e5',
          backgroundColor: 'rgba(79, 70, 229, 0.1)',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.1,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            display: true,
            title: {
              display: false
            },
            ticks: {
              maxTicksLimit: 5
            }
          },
          y: {
            display: true,
            min: axisConfig.min !== undefined ? axisConfig.min : undefined,
            max: axisConfig.max !== undefined ? axisConfig.max : undefined,
            ticks: {
              maxTicksLimit: 5
            }
          }
        }
      }
    });

    this.timeSeriesCharts.push(chart);
  }

  renderSimpleChart(canvas, data, axisConfig) {
    const ctx = canvas.getContext('2d');
    const width = canvas.parentElement.clientWidth || 300;
    const height = canvas.parentElement.clientHeight || 100;
    
    canvas.width = width;
    canvas.height = height;
    
    // Handle edge case of single data point or empty data
    if (!data || data.length === 0) {
      ctx.fillStyle = '#ddd';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#666';
      ctx.textAlign = 'center';
      ctx.fillText('No data', width / 2, height / 2);
      return;
    }
    
    // Calculate data bounds
    let minVal = axisConfig.min !== undefined ? axisConfig.min : Math.min(...data);
    let maxVal = axisConfig.max !== undefined ? axisConfig.max : Math.max(...data);
    const range = maxVal - minVal || 1;
    
    // Draw background
    ctx.fillStyle = 'rgba(79, 70, 229, 0.1)';
    ctx.fillRect(0, 0, width, height);
    
    // Draw the line
    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    
    const divisor = data.length > 1 ? data.length - 1 : 1;
    for (let i = 0; i < data.length; i++) {
      const x = (i / divisor) * width;
      const y = height - ((data[i] - minVal) / range) * height;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    ctx.stroke();
  }

  collectLabels() {
    const labels = {};
    const labelGroups = document.querySelectorAll('.label-group');
    
    labelGroups.forEach(group => {
      const labelName = group.dataset.labelName;
      
      // Check for time-series container
      const timeSeriesContainer = group.querySelector('.time-series-container');
      if (timeSeriesContainer) {
        const seriesLabels = {};
        const seriesSelects = timeSeriesContainer.querySelectorAll('.series-select');
        seriesSelects.forEach(select => {
          const index = select.dataset.seriesIndex;
          seriesLabels[`series_${index}`] = select.value;
        });

        const globalRadio = timeSeriesContainer.querySelector(`input[name="global-${labelName}"]:checked`);
        const globalLabel = globalRadio ? globalRadio.value : '';

        const commentTextarea = timeSeriesContainer.querySelector('.comment-textarea');
        const comment = commentTextarea ? commentTextarea.value.trim() : '';

        labels[labelName] = {
          seriesLabels,
          globalLabel,
          comment
        };
        return;
      }
      
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
    
    const missingLabels = requiredLabels.filter(name => {
      const value = labels[name];
      if (!value) return true;
      // For time-series, check globalLabel is set
      if (typeof value === 'object' && value.seriesLabels !== undefined) {
        return !value.globalLabel;
      }
      return false;
    });
    
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
      
      // Restore time-series labels
      if (typeof value === 'object' && value.seriesLabels !== undefined) {
        const timeSeriesContainer = group.querySelector('.time-series-container');
        if (timeSeriesContainer) {
          // Restore series labels
          Object.entries(value.seriesLabels).forEach(([seriesKey, seriesValue]) => {
            const index = seriesKey.replace('series_', '');
            const select = timeSeriesContainer.querySelector(`.series-select[data-series-index="${index}"]`);
            if (select) {
              select.value = seriesValue;
            }
          });
          
          // Restore global label
          if (value.globalLabel) {
            const globalRadio = timeSeriesContainer.querySelector(`input[name="global-${labelName}"][value="${value.globalLabel}"]`);
            if (globalRadio) {
              globalRadio.checked = true;
            }
          }
          
          // Restore comment
          if (value.comment) {
            const commentTextarea = timeSeriesContainer.querySelector('.comment-textarea');
            if (commentTextarea) {
              commentTextarea.value = value.comment;
            }
          }
        }
        return;
      }
      
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
      
      // Number keys for hotkeys - iterate through all options to find matching hotkey
      if (e.key >= '1' && e.key <= '9') {
        const allOptions = document.querySelectorAll('.choice-option .choice-hotkey');
        allOptions.forEach(hotkeyEl => {
          if (hotkeyEl.textContent === e.key) {
            hotkeyEl.closest('.choice-option').click();
          }
        });
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
