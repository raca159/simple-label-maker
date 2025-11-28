// Simple Label Maker - Frontend Application

// Register custom Chart.js plugin for crosshair
if (typeof Chart !== 'undefined') {
  Chart.register({
    id: 'crosshair',
    afterDatasetsDraw(chart) {
      const canvas = chart.canvas;
      const hoverX = canvas.dataset.hoverX;
      
      if (!hoverX || !chart.chartArea) return;
      
      const ctx = chart.ctx;
      const chartArea = chart.chartArea;
      
      // Save state and draw on top of everything
      ctx.save();
      ctx.strokeStyle = 'rgba(79, 70, 229, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      
      const x = parseFloat(hoverX);
      if (x >= chartArea.left && x <= chartArea.right) {
        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
      }
      
      ctx.restore();
    }
  });
}

class LabelMaker {
  constructor() {
    this.currentSampleId = null;
    this.samples = [];
    this.allSamples = []; // Store all samples for reference
    this.uiSchema = null;
    this.projectInfo = null;
    this.annotations = {};
    this.currentSeriesData = null;
    this.timeSeriesCharts = [];
    this.dataPanelCharts = [];
    this.helpShown = false;
    this.escapeListenerAdded = false;
    this.helpContentRendered = false;
    this.sampleControl = {}; // Sample control configuration
    this.totalSamples = 0; // Total samples in project
    
    this.init();
  }

  async init() {
    try {
      // Load project info first to get sample control settings
      await this.loadProjectInfo();
      
      // Load UI schema
      await this.loadUISchema();
      
      // Load saved annotations from localStorage before filtering
      this.loadSavedAnnotations();
      
      // Load samples (filtered if configured)
      await this.loadSamples();

      // Set up event listeners
      this.setupEventListeners();

      // Apply sample control settings to UI
      this.applySampleControlSettings();

      // Initialize help modal if configured
      this.initializeHelpModal();

      // Get current sample from URL or load first sample
      const pathMatch = window.location.pathname.match(/\/label\/(.+)/);
      if (pathMatch) {
        await this.loadSample(pathMatch[1]);
      } else if (this.samples.length > 0) {
        await this.loadSample(this.samples[0].id);
      } else {
        // No samples available (all annotated)
        this.showCompletionMessage();
      }

    } catch (error) {
      console.error('Failed to initialize:', error);
      this.showToast('Failed to initialize application', 'error');
    }
  }

  async loadProjectInfo() {
    const response = await fetch('/api/project');
    this.projectInfo = await response.json();
    
    // Store sample control settings
    this.sampleControl = this.projectInfo.sampleControl || {};
    this.totalSamples = this.projectInfo.totalSamples;
    
    document.getElementById('projectName').textContent = this.projectInfo.projectName;
    document.getElementById('projectDescription').textContent = 
      this.projectInfo.description || 'No description provided.';
  }

  async loadUISchema() {
    const response = await fetch('/api/ui-schema');
    this.uiSchema = await response.json();
    
    document.getElementById('labelingTitle').textContent = 
      this.uiSchema.labelingInterface.title || 'Labels';
    
    // Inject custom styles if provided in UI.xml
    this.applyCustomStyles();
  }

  applyCustomStyles() {
    // Remove any previously injected custom styles
    const existingStyle = document.getElementById('custom-ui-styles');
    if (existingStyle) {
      existingStyle.remove();
    }
    
    // Inject new custom styles if provided
    // Note: Custom styles come from UI.xml which is a project configuration file
    // managed by administrators. This follows the same pattern as Label Studio.
    const customStyles = this.uiSchema?.labelingInterface?.customStyles;
    if (customStyles) {
      const styleElement = document.createElement('style');
      styleElement.id = 'custom-ui-styles';
      styleElement.textContent = customStyles;
      document.head.appendChild(styleElement);
    }
  }

  initializeHelpModal() {
    const helpConfig = this.uiSchema?.labelingInterface?.help;
    if (!helpConfig || !helpConfig.resources || helpConfig.resources.length === 0) {
      return;
    }

    // Show the help button
    const helpBtn = document.getElementById('helpBtn');
    if (helpBtn) {
      helpBtn.style.display = 'inline-flex';
    }

    // Render help content
    this.renderHelpContent(helpConfig);

    // Setup help modal event listeners
    this.setupHelpModalListeners();

    // Show modal on load if configured
    if (helpConfig.showOnLoad && !this.helpShown) {
      this.showHelpModal();
      this.helpShown = true;
    }
  }

  renderHelpContent(helpConfig) {
    const modalTitle = document.getElementById('helpModalTitle');
    const modalContent = document.getElementById('helpModalContent');

    if (modalTitle) {
      modalTitle.textContent = helpConfig.title || 'Help & Guides';
    }

    if (!modalContent) return;

    // Only render if not already rendered
    if (this.helpContentRendered) return;
    this.helpContentRendered = true;

    modalContent.innerHTML = '';

    helpConfig.resources.forEach(resource => {
      const resourceEl = document.createElement('div');
      resourceEl.className = 'help-resource';

      const header = document.createElement('div');
      header.className = 'help-resource-header';

      const icon = document.createElement('div');
      icon.className = 'help-resource-icon';
      icon.textContent = this.getResourceIcon(resource.type);

      const title = document.createElement('h3');
      title.className = 'help-resource-title';
      title.textContent = resource.title;

      header.appendChild(icon);
      header.appendChild(title);
      resourceEl.appendChild(header);

      const content = document.createElement('div');
      content.className = 'help-resource-content';
      content.appendChild(this.renderResourceContent(resource));
      resourceEl.appendChild(content);

      modalContent.appendChild(resourceEl);
    });
  }

  getResourceIcon(type) {
    switch (type) {
      case 'video': return '🎬';
      case 'pdf': return '📄';
      case 'text': return '📝';
      case 'audio': return '🔊';
      case 'link': return '🔗';
      default: return '📌';
    }
  }

  isSafeUrl(url) {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  renderResourceContent(resource) {
    const container = document.createElement('div');

    switch (resource.type) {
      case 'video':
        if (resource.url && this.isSafeUrl(resource.url)) {
          const embedUrl = this.getVideoEmbedUrl(resource.url);
          if (embedUrl) {
            const videoContainer = document.createElement('div');
            videoContainer.className = 'help-video-container';
            const iframe = document.createElement('iframe');
            iframe.src = embedUrl;
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
            iframe.allowFullscreen = true;
            iframe.sandbox = 'allow-scripts allow-same-origin allow-presentation';
            videoContainer.appendChild(iframe);
            container.appendChild(videoContainer);
          } else {
            // Fallback to link
            const link = document.createElement('a');
            link.href = resource.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.className = 'help-external-link';
            link.textContent = 'Watch Video ↗';
            container.appendChild(link);
          }
        }
        break;

      case 'pdf':
        if (resource.url && this.isSafeUrl(resource.url)) {
          const link = document.createElement('a');
          link.href = resource.url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.className = 'help-pdf-link';
          link.textContent = '📄 Open PDF Document ↗';
          container.appendChild(link);
        }
        break;

      case 'text':
        const textContent = document.createElement('p');
        textContent.textContent = resource.content || '';
        container.appendChild(textContent);
        break;

      case 'audio':
        if (resource.url && this.isSafeUrl(resource.url)) {
          const audio = document.createElement('audio');
          audio.controls = true;
          audio.className = 'help-audio-player';
          audio.src = resource.url;
          container.appendChild(audio);
        }
        break;

      case 'link':
      default:
        if (resource.url && this.isSafeUrl(resource.url)) {
          const link = document.createElement('a');
          link.href = resource.url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.className = 'help-external-link';
          link.textContent = resource.content || 'Open Link ↗';
          container.appendChild(link);
        } else if (resource.content) {
          const textContent = document.createElement('p');
          textContent.textContent = resource.content;
          container.appendChild(textContent);
        }
        break;
    }

    return container;
  }

  getVideoEmbedUrl(url) {
    // YouTube - video IDs are exactly 11 characters
    const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[?&]|$)/);
    if (youtubeMatch && youtubeMatch[1].length === 11) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    }

    // Google Drive - file IDs are typically 33 characters
    const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{25,50})/);
    if (driveMatch) {
      return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
    }

    // Vimeo - video IDs are numeric
    const vimeoMatch = url.match(/vimeo\.com\/(\d{1,12})(?:[?/]|$)/);
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }

    return null;
  }

  setupHelpModalListeners() {
    const helpBtn = document.getElementById('helpBtn');
    const closeBtn = document.getElementById('helpModalClose');
    const closeBtnFooter = document.getElementById('helpModalCloseBtn');
    const overlay = document.getElementById('helpModalOverlay');

    if (helpBtn) {
      helpBtn.addEventListener('click', () => this.showHelpModal());
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hideHelpModal());
    }

    if (closeBtnFooter) {
      closeBtnFooter.addEventListener('click', () => this.hideHelpModal());
    }

    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this.hideHelpModal();
        }
      });
    }

    // Close on Escape key, only add listener once
    if (!this.escapeListenerAdded) {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          const overlay = document.getElementById('helpModalOverlay');
          if (overlay && overlay.style.display !== 'none') {
            this.hideHelpModal();
          }
        }
      });
      this.escapeListenerAdded = true;
    }
  }

  getFocusableElements(container) {
    return container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
  }

  showHelpModal() {
    const overlay = document.getElementById('helpModalOverlay');
    if (overlay) {
      overlay.style.display = 'flex';
      // Move focus to close button when modal opens
      const closeBtn = document.getElementById('helpModalClose');
      if (closeBtn) {
        closeBtn.focus();
      }
      // Setup focus trap
      this.setupFocusTrap(overlay);
    }
  }

  setupFocusTrap(container) {
    const focusableElements = this.getFocusableElements(container);
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    container.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift+Tab: if on first element, go to last
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        }
      } else {
        // Tab: if on last element, go to first
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
    });
  }

  hideHelpModal() {
    const overlay = document.getElementById('helpModalOverlay');
    if (overlay) {
      overlay.style.display = 'none';
      // Return focus to help button when modal closes
      const helpBtn = document.getElementById('helpBtn');
      if (helpBtn) {
        helpBtn.focus();
      }
    }
  }

  async loadSamples() {
    // First get all samples for reference
    const allResponse = await fetch('/api/samples');
    this.allSamples = await allResponse.json();
    
    // If filtering is enabled, use the filtered endpoint
    if (this.sampleControl.filterAnnotatedSamples) {
      const response = await fetch('/api/samples/filtered');
      const data = await response.json();
      
      // If server indicates we should filter on client (demo mode)
      if (data.filterOnClient) {
        // Filter out samples that are already annotated locally
        this.samples = this.allSamples.filter(s => !this.annotations[s.id]);
      } else {
        this.samples = data.samples;
      }
      
      this.totalSamples = data.totalSamples;
    } else {
      this.samples = this.allSamples;
    }
    
    this.updateProgress();
  }

  applySampleControlSettings() {
    const skipBtn = document.getElementById('skipBtn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    // Hide/disable buttons based on sample control settings
    if (this.sampleControl.disableSkip && skipBtn) {
      skipBtn.style.display = 'none';
    }
    
    if (this.sampleControl.disablePrevious && prevBtn) {
      prevBtn.style.display = 'none';
    }
    
    if (this.sampleControl.disableNext && nextBtn) {
      nextBtn.style.display = 'none';
    }
  }

  showCompletionMessage() {
    const dataContent = document.getElementById('dataContent');
    const labelingInterface = document.getElementById('labelingInterface');
    const actionBar = document.querySelector('.action-bar');
    
    dataContent.innerHTML = `
      <div class="completion-message">
        <div class="completion-icon">🎉</div>
        <h2>All Done!</h2>
        <p>You have completed labeling all available samples.</p>
        <p class="completion-stats">Total samples annotated: ${Object.keys(this.annotations).length} / ${this.totalSamples}</p>
      </div>
    `;
    
    if (labelingInterface) {
      labelingInterface.innerHTML = '';
    }
    
    if (actionBar) {
      actionBar.style.display = 'none';
    }
    
    document.getElementById('sampleId').textContent = 'Complete';
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
    
    // Destroy any existing data panel charts before rendering new ones
    if (this.dataPanelCharts) {
      this.dataPanelCharts.forEach(chart => chart.destroy());
    }
    this.dataPanelCharts = [];
    
    if (sampleData.type === 'image') {
      dataContent.innerHTML = `<img src="${sampleData.url}" alt="Sample image" />`;
    } else if (sampleData.type === 'text') {
      dataContent.innerHTML = `<div class="text-content">${this.escapeHtml(sampleData.content)}</div>`;
    } else if (sampleData.type === 'audio') {
      dataContent.innerHTML = `<audio controls src="${sampleData.url}"></audio>`;
    } else if (sampleData.type === 'video') {
      dataContent.innerHTML = `<video controls src="${sampleData.url}"></video>`;
    } else if (sampleData.type === 'time-series') {
      // Store series data for later rendering in the labeling interface
      this.currentSeriesData = sampleData.seriesData;
      
      // For time-series, the left panel is empty - all visualization happens in the right panel
      dataContent.innerHTML = `
        <div class="time-series-empty-message">
          <p>View and classify time-series data in the labeling panel on the right.</p>
        </div>
      `;
    }
  }

  renderLabelingInterface() {
    const container = document.getElementById('labelingInterface');
    const labels = this.uiSchema.labelingInterface.labels;
    const layout = this.uiSchema.labelingInterface.layout;
    
    container.innerHTML = '';
    
    // Apply layout classes
    if (layout?.cssClass) {
      container.classList.add(layout.cssClass);
    }
    if (layout?.spacing) {
      container.classList.add(`spacing-${layout.spacing}`);
    }
    
    // Don't destroy data panel charts - only destroy any labeling interface charts
    // (which shouldn't exist for time-series anymore, but kept for compatibility)
    this.timeSeriesCharts = [];
    
    labels.forEach(label => {
      const labelGroup = document.createElement('div');
      labelGroup.className = 'label-group';
      labelGroup.dataset.labelName = label.name;
      
      // Apply custom CSS class if provided
      if (label.cssClass) {
        labelGroup.classList.add(label.cssClass);
      }
      
      // Title (skip for time-series since instructions are the header)
      if (label.type !== 'time-series') {
        const title = document.createElement('div');
        title.className = 'label-group-title';
        title.innerHTML = `
          ${label.name}
          ${label.required ? '<span class="required-badge">Required</span>' : ''}
        `;
        labelGroup.appendChild(title);
      }
      
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

    // Instructions section at the top
    const instructionsSection = document.createElement('div');
    instructionsSection.className = 'time-series-instructions-section';
    
    const instructionsText = document.createElement('p');
    instructionsText.className = 'instructions-text';
    instructionsText.textContent = 'Classify each ECG lead individually, then provide a global classification and any observations.';
    instructionsSection.appendChild(instructionsText);
    container.appendChild(instructionsSection);

    // Global classification section (moved to top, right after instructions)
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

    // Per-series rows with charts and labels side by side
    const seriesRowsSection = document.createElement('div');
    seriesRowsSection.className = 'series-rows-section';
    
    for (let i = 0; i < seriesCount; i++) {
      const rowContainer = document.createElement('div');
      rowContainer.className = 'series-row-with-chart';
      rowContainer.dataset.seriesIndex = i;

      // Left side: chart
      const chartCol = document.createElement('div');
      chartCol.className = 'series-chart-col';
      
      const seriesLabel = document.createElement('div');
      seriesLabel.className = 'series-chart-label';
      seriesLabel.textContent = `Lead ${i + 1}`;
      chartCol.appendChild(seriesLabel);
      
      const chartContainer = document.createElement('div');
      chartContainer.className = 'chart-container-inline';
      const canvas = document.createElement('canvas');
      canvas.id = `chart-label-${i}`;
      canvas.className = 'series-chart-inline';
      chartContainer.appendChild(canvas);
      chartCol.appendChild(chartContainer);
      
      rowContainer.appendChild(chartCol);

      // Right side: classification radio buttons (compact)
      const selectCol = document.createElement('div');
      selectCol.className = 'series-select-col-inline';
      
      const optionsContainer = document.createElement('div');
      optionsContainer.className = 'series-options-inline';
      
      seriesOptions.forEach(opt => {
        const optLabel = document.createElement('label');
        optLabel.className = 'series-option-btn';
        if (label.buttonSize === 'small') {
          optLabel.classList.add('btn-small');
        } else if (label.buttonSize === 'large') {
          optLabel.classList.add('btn-large');
        } else {
          optLabel.classList.add('btn-medium');
        }
        optLabel.style.backgroundColor = opt.color || '#ddd';
        optLabel.title = opt.label;
        
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = `series-${i}`;
        radio.value = opt.value;
        radio.dataset.seriesIndex = i;
        
        const text = document.createElement('span');
        text.textContent = opt.label;
        
        optLabel.appendChild(radio);
        optLabel.appendChild(text);
        optionsContainer.appendChild(optLabel);
      });
      
      selectCol.appendChild(optionsContainer);
      rowContainer.appendChild(selectCol);
      seriesRowsSection.appendChild(rowContainer);

      // Render chart
      const data = seriesData[i] || this.generateDemoSeriesData();
      this.renderSeriesChart(canvas, data, i, { min: -1, max: 1 }, false, label.showSeriesTitles || false, label.xAxisTickSize !== undefined ? label.xAxisTickSize : 11);
    }
    
    container.appendChild(seriesRowsSection);

    // Comment section at the bottom
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

  renderSeriesChart(canvas, data, seriesIndex, axisConfig, isDataPanel = false, showTitle = false, xAxisTickSize = 11) {
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
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: showTitle,
            text: `Lead ${seriesIndex + 1}`,
            font: {
              size: 11,
              weight: 'bold'
            },
            color: '#475569',
            padding: {
              top: 2,
              bottom: 4
            },
            align: 'start'
          },
          tooltip: {
            enabled: false
          },
          crosshair: {
            line: {
              color: 'rgba(79, 70, 229, 0.3)',
              width: 1
            }
          }
        },
        scales: {
          x: {
            display: true,
            title: {
              display: false
            },
            ticks: {
              maxTicksLimit: xAxisTickSize > 0 ? 5 : 0,
              display: xAxisTickSize > 0,
              font: {
                size: xAxisTickSize
              }
            },
            grid: {
              display: true,
              color: 'rgba(203, 213, 225, 0.5)',
              drawBorder: false,
              drawOnChartArea: true,
              drawTicks: true,
              lineWidth: 1.2
            }
          },
          y: {
            display: true,
            min: axisConfig.min !== undefined ? axisConfig.min : undefined,
            max: axisConfig.max !== undefined ? axisConfig.max : undefined,
            ticks: {
              maxTicksLimit: 5
            },
            grid: {
              display: true,
              color: 'rgba(203, 213, 225, 0.3)',
              drawBorder: false,
              drawOnChartArea: true,
              drawTicks: false,
              lineWidth: 0.8
            }
          }
        }
      }
    });

    // Track charts in appropriate array
    if (isDataPanel) {
      this.dataPanelCharts.push(chart);
    } else {
      this.timeSeriesCharts.push(chart);
    }

    // Add hover listener for synchronized crosshair across all charts
    canvas.addEventListener('mousemove', (e) => {
      if (isDataPanel) return; // Only sync on labeling interface charts
      
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const chartArea = chart.chartArea;
      
      // Update all charts to show the vertical line
      this.timeSeriesCharts.forEach(c => {
        c.canvas.dataset.hoverX = x;
        c.draw();
      });
    });

    canvas.addEventListener('mouseleave', () => {
      if (isDataPanel) return;
      this.timeSeriesCharts.forEach(c => {
        delete c.canvas.dataset.hoverX;
        c.draw();
      });
    });
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
        
        // Collect radio button selections for each series
        for (let i = 0; i < 10; i++) {
          const checkedRadio = timeSeriesContainer.querySelector(`input[name="series-${i}"]:checked`);
          if (checkedRadio) {
            seriesLabels[`series_${i}`] = checkedRadio.value;
          }
        }

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
        
        // If filtering is enabled, remove the current sample from the filtered list
        if (this.sampleControl.filterAnnotatedSamples) {
          this.samples = this.samples.filter(s => s.id !== this.currentSampleId);
        }
        
        this.updateProgress();
        
        // Move to next sample
        const navInfo = await this.getNavigationInfo();
        if (navInfo.hasNext) {
          this.loadSample(navInfo.nextId);
        } else if (this.samples.length > 0) {
          // If no next, load first remaining sample (for filtered mode)
          this.loadSample(this.samples[0].id);
        } else if (this.sampleControl.filterAnnotatedSamples) {
          // All samples completed
          this.showCompletionMessage();
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

  getLocalNavigationInfo() {
    // Get navigation info based on the filtered samples list
    const currentIndex = this.samples.findIndex(s => s.id === this.currentSampleId);
    
    return {
      current: currentIndex + 1,
      total: this.samples.length,
      hasPrevious: currentIndex > 0,
      hasNext: currentIndex < this.samples.length - 1,
      previousId: currentIndex > 0 ? this.samples[currentIndex - 1]?.id : null,
      nextId: currentIndex < this.samples.length - 1 ? this.samples[currentIndex + 1]?.id : null
    };
  }

  async getNavigationInfo() {
    // If filtering is enabled, use local navigation based on filtered samples
    if (this.sampleControl.filterAnnotatedSamples) {
      return this.getLocalNavigationInfo();
    }
    
    // Otherwise, use server-side navigation
    const response = await fetch(`/api/navigation/${this.currentSampleId}`);
    return await response.json();
  }

  async updateNavigation() {
    const navInfo = await this.getNavigationInfo();
    
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    // Respect sample control settings
    if (!this.sampleControl.disablePrevious && prevBtn) {
      prevBtn.disabled = !navInfo.hasPrevious;
      prevBtn.onclick = () => {
        if (navInfo.previousId) this.loadSample(navInfo.previousId);
      };
    }
    
    if (!this.sampleControl.disableNext && nextBtn) {
      nextBtn.disabled = !navInfo.hasNext;
      nextBtn.onclick = () => {
        if (navInfo.nextId) this.loadSample(navInfo.nextId);
      };
    }
  }

  updateProgress() {
    const annotatedSamples = Object.keys(this.annotations).length;
    
    // When filtering is enabled, show progress as "annotated / total" with remaining in the filtered list
    if (this.sampleControl.filterAnnotatedSamples) {
      // Show how many samples have been annotated out of the total project samples
      const percentage = this.totalSamples > 0 ? (annotatedSamples / this.totalSamples) * 100 : 0;
      document.getElementById('progressText').textContent = `${annotatedSamples} / ${this.totalSamples}`;
      document.getElementById('progressFill').style.width = `${percentage}%`;
    } else {
      // Standard progress: show based on samples list
      const totalSamples = this.samples.length;
      const percentage = totalSamples > 0 ? (annotatedSamples / totalSamples) * 100 : 0;
      document.getElementById('progressText').textContent = `${annotatedSamples} / ${totalSamples}`;
      document.getElementById('progressFill').style.width = `${percentage}%`;
    }
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
