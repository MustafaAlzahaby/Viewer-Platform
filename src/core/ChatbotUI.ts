import type { ChatbotController, CommandResult } from "./ChatbotController";

/**
 * Message interface for chat history
 */
export interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  result?: CommandResult;
}

/**
 * Chatbot UI Component
 * 
 * Responsibilities:
 * - Render chat widget UI
 * - Handle user input
 * - Display chat history
 * - Manage UI state (open/closed)
 */
export class ChatbotUI {
  private controller: ChatbotController;
  private container: HTMLElement | null = null;
  private chatWindow: HTMLElement | null = null;
  private isOpen = false;
  private messages: ChatMessage[] = [];
  private inputElement: HTMLInputElement | null = null;

  constructor(controller: ChatbotController) {
    this.controller = controller;
  }

  /**
   * Initialize and render the chatbot UI
   */
  public initialize(): void {
    // Defer style injection to avoid blocking
    // Inject styles first (lightweight operation)
    this.injectStyles();
    
    // Then create widget (DOM operations)
    requestAnimationFrame(() => {
      this.createChatWidget();
      // Add welcome message after widget is created
      requestAnimationFrame(() => {
        this.addWelcomeMessage();
      });
    });
  }

  /**
   * Create the chat widget DOM structure
   */
  private createChatWidget(): void {
    // Main container
    this.container = document.createElement("div");
    this.container.className = "chatbot-container";
    this.container.innerHTML = `
      <!-- Floating button -->
      <button class="chatbot-toggle-btn" aria-label="Open chatbot">
        <div class="chatbot-icon-wrapper">
          <svg class="chatbot-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <span class="chatbot-badge">AI</span>
      </button>

      <!-- Chat window -->
      <div class="chatbot-window">
        <div class="chatbot-header">
          <div class="chatbot-header-content">
            <div class="chatbot-header-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div class="chatbot-header-text">
              <h3 class="chatbot-title">Nexus</h3>
              <p class="chatbot-subtitle">AI Assistant</p>
            </div>
          </div>
          <button class="chatbot-close-btn" aria-label="Close chatbot">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="chatbot-messages" id="chatbot-messages">
          <!-- Messages will be inserted here -->
        </div>

        <div class="chatbot-input-container">
          <input 
            type="text" 
            class="chatbot-input" 
            placeholder="Type a command... (e.g., 'Show completed elements')"
            autocomplete="off"
          />
          <button class="chatbot-send-btn" aria-label="Send message">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(this.container);

    // Get references to elements
    this.chatWindow = this.container.querySelector(".chatbot-window");
    const toggleBtn = this.container.querySelector(".chatbot-toggle-btn");
    const closeBtn = this.container.querySelector(".chatbot-close-btn");
    this.inputElement = this.container.querySelector(".chatbot-input") as HTMLInputElement;
    const sendBtn = this.container.querySelector(".chatbot-send-btn");

    // Event listeners
    toggleBtn?.addEventListener("click", () => this.toggle());
    closeBtn?.addEventListener("click", () => this.close());
    sendBtn?.addEventListener("click", () => this.handleSend());
    this.inputElement?.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.handleSend();
      }
    });

    // Close on outside click
    this.container.addEventListener("click", (e) => {
      if (e.target === this.container && this.isOpen) {
        this.close();
      }
    });
  }

  /**
   * Add welcome message to chat
   */
  private addWelcomeMessage(): void {
    this.addMessage({
      id: `msg-${Date.now()}`,
      text: "Hi! I'm Nexus, your AI assistant for this BIM viewer. I can help you explore the 3D model, filter elements by category or status, navigate between levels, and track project progress.",
      isUser: false,
      timestamp: new Date(),
    });
    
    // Add choice buttons after welcome message
    setTimeout(() => {
      this.showChoiceButtons();
    }, 100);
  }

  /**
   * Toggle chat window open/closed
   */
  public toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Open chat window
   */
  public open(): void {
    if (!this.container || !this.chatWindow) return;
    this.isOpen = true;
    this.container.classList.add("chatbot-open");
    this.chatWindow.classList.add("chatbot-window-open");
    
    // Focus input
    setTimeout(() => {
      this.inputElement?.focus();
    }, 100);
  }

  /**
   * Close chat window
   */
  public close(): void {
    if (!this.container || !this.chatWindow) return;
    this.isOpen = false;
    this.container.classList.remove("chatbot-open");
    this.chatWindow.classList.remove("chatbot-window-open");
  }

  /**
   * Handle send button click or Enter key
   */
  private async handleSend(): Promise<void> {
    if (!this.inputElement) return;

    const input = this.inputElement.value.trim();
    if (!input) return;

    // Keep choice buttons visible above the command
    // Don't hide them when user types

    // Add user message
    this.addUserMessage(input);

    // Clear input
    this.inputElement.value = "";

    // Show typing indicator
    const typingId = this.addTypingIndicator();

    try {
      // Process command
      const result = await this.controller.processInput(input);

      // Remove typing indicator
      this.removeMessage(typingId);

      // Add bot response
      this.addBotMessage(result.message, result);

      // If command was unknown, show choice buttons
      if (result.commandType === "unknown" && !result.success) {
        setTimeout(() => {
          this.showChoiceButtons();
        }, 300);
      }
    } catch (error) {
      console.error("[ChatbotUI] Error processing input:", error);
      this.removeMessage(typingId);
      this.addBotMessage("Sorry, something went wrong. Please try again.", {
        success: false,
        message: "Error occurred",
        commandType: "unknown",
      });
      // Show choice buttons on error too
      setTimeout(() => {
        this.showChoiceButtons();
      }, 300);
    }
  }

  /**
   * Add a message to the chat
   */
  private addMessage(message: ChatMessage): void {
    this.messages.push(message);
    this.renderMessage(message);
  }

  /**
   * Add user message
   */
  private addUserMessage(text: string): void {
    this.addMessage({
      id: `msg-${Date.now()}-${Math.random()}`,
      text,
      isUser: true,
      timestamp: new Date(),
    });
  }

  /**
   * Add bot message
   */
  private addBotMessage(text: string, result?: CommandResult): void {
    this.addMessage({
      id: `msg-${Date.now()}-${Math.random()}`,
      text,
      isUser: false,
      timestamp: new Date(),
      result,
    });
  }

  /**
   * Add typing indicator
   */
  private addTypingIndicator(): string {
    const id = `typing-${Date.now()}`;
    const messagesContainer = document.getElementById("chatbot-messages");
    if (!messagesContainer) return id;

    const typingDiv = document.createElement("div");
    typingDiv.id = id;
    typingDiv.className = "chatbot-message chatbot-message-bot chatbot-typing";
    typingDiv.innerHTML = `
      <div class="chatbot-typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `;
    messagesContainer.appendChild(typingDiv);
    this.scrollToBottom();

    return id;
  }

  /**
   * Remove a message by ID
   */
  private removeMessage(id: string): void {
    const element = document.getElementById(id);
    if (element) {
      element.remove();
    }
    this.messages = this.messages.filter(m => m.id !== id);
  }

  /**
   * Render a message in the chat
   */
  private renderMessage(message: ChatMessage): void {
    const messagesContainer = document.getElementById("chatbot-messages");
    if (!messagesContainer) return;

    const messageDiv = document.createElement("div");
    messageDiv.id = message.id;
    messageDiv.className = `chatbot-message ${message.isUser ? "chatbot-message-user" : "chatbot-message-bot"}`;
    
    if (message.result) {
      messageDiv.classList.add(message.result.success ? "chatbot-message-success" : "chatbot-message-error");
      
      // Add special class for completion percentage
      if (message.result.commandType === "completion-percentage") {
        messageDiv.classList.add("chatbot-message-percentage");
      }
    }

    // Format message text (preserve line breaks)
    let formattedText = message.text
      .split("\n")
      .map(line => `<div>${this.escapeHtml(line)}</div>`)
      .join("");
    
    // Special formatting for completion percentage
    if (message.result?.commandType === "completion-percentage") {
      formattedText = `<div class="chatbot-percentage-display">${this.escapeHtml(message.text)}</div>`;
    }

    messageDiv.innerHTML = `
      <div class="chatbot-message-content">
        ${formattedText}
      </div>
      <div class="chatbot-message-time">
        ${this.formatTime(message.timestamp)}
      </div>
    `;

    messagesContainer.appendChild(messageDiv);
    this.scrollToBottom();
  }

  /**
   * Scroll chat to bottom
   */
  private scrollToBottom(): void {
    const messagesContainer = document.getElementById("chatbot-messages");
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  /**
   * Format timestamp for display
   */
  private formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Inject CSS styles
   */
  private injectStyles(): void {
    const style = document.createElement("style");
    style.textContent = `
      /* Chatbot Container */
      .chatbot-container {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 2000;
        font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      /* Toggle Button */
      .chatbot-toggle-btn {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        border: none;
        box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        color: white;
      }

      .chatbot-toggle-btn:hover {
        transform: scale(1.1);
        box-shadow: 0 12px 32px rgba(99, 102, 241, 0.5);
      }

      .chatbot-toggle-btn:active {
        transform: scale(0.95);
      }

      .chatbot-icon-wrapper {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .chatbot-icon {
        width: 28px;
        height: 28px;
        animation: iconFloat 3s ease-in-out infinite;
      }

      @keyframes iconFloat {
        0%, 100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(-3px);
        }
      }

      .chatbot-toggle-btn:hover .chatbot-icon {
        animation: iconFloat 1.5s ease-in-out infinite, iconPulse 2s ease-in-out infinite;
      }

      @keyframes iconPulse {
        0%, 100% {
          transform: scale(1);
          opacity: 1;
        }
        50% {
          transform: scale(1.1);
          opacity: 0.9;
        }
      }

      .chatbot-badge {
        position: absolute;
        top: -4px;
        right: -4px;
        background: #10b981;
        color: white;
        font-size: 10px;
        font-weight: 800;
        padding: 2px 6px;
        border-radius: 10px;
        border: 2px solid white;
        letter-spacing: 0.5px;
      }

      /* Chat Window */
      .chatbot-window {
        position: absolute;
        bottom: 80px;
        right: 0;
        width: 400px;
        max-width: calc(100vw - 48px);
        height: 600px;
        max-height: calc(100vh - 120px);
        background: rgba(255, 255, 255, 0.98);
        backdrop-filter: blur(12px);
        border-radius: 24px;
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.25);
        border: 1px solid rgba(226, 232, 240, 0.95);
        display: flex;
        flex-direction: column;
        opacity: 0;
        transform: translateY(20px) scale(0.95);
        pointer-events: none;
        transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      .chatbot-window-open {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: all;
      }

      /* Header */
      .chatbot-header {
        padding: 20px 24px;
        border-bottom: 1px solid rgba(226, 232, 240, 0.8);
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.05));
        border-radius: 24px 24px 0 0;
      }

      .chatbot-header-content {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .chatbot-header-icon {
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
      }

      .chatbot-header-icon svg {
        width: 20px;
        height: 20px;
      }

      .chatbot-title {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 700;
        color: #0f172a;
        letter-spacing: -0.02em;
      }

      .chatbot-subtitle {
        margin: 0;
        font-size: 0.75rem;
        color: #64748b;
        font-weight: 500;
      }

      .chatbot-close-btn {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        border: none;
        background: transparent;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #64748b;
        transition: all 0.2s;
      }

      .chatbot-close-btn:hover {
        background: rgba(226, 232, 240, 0.8);
        color: #0f172a;
      }

      .chatbot-close-btn svg {
        width: 18px;
        height: 18px;
      }

      /* Messages */
      .chatbot-messages {
        flex: 1;
        overflow-y: auto;
        padding: 20px 24px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .chatbot-messages::-webkit-scrollbar {
        width: 6px;
      }

      .chatbot-messages::-webkit-scrollbar-track {
        background: transparent;
      }

      .chatbot-messages::-webkit-scrollbar-thumb {
        background: rgba(226, 232, 240, 0.8);
        border-radius: 3px;
      }

      .chatbot-messages::-webkit-scrollbar-thumb:hover {
        background: rgba(203, 213, 225, 0.9);
      }

      .chatbot-message {
        display: flex;
        flex-direction: column;
        gap: 4px;
        animation: messageSlideIn 0.3s ease-out;
      }

      @keyframes messageSlideIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .chatbot-message-user {
        align-items: flex-end;
      }

      .chatbot-message-bot {
        align-items: flex-start;
      }

      .chatbot-message-content {
        max-width: 80%;
        padding: 12px 16px;
        border-radius: 18px;
        font-size: 0.9rem;
        line-height: 1.5;
        word-wrap: break-word;
      }

      .chatbot-message-user .chatbot-message-content {
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: white;
        border-bottom-right-radius: 4px;
      }

      .chatbot-message-bot .chatbot-message-content {
        background: rgba(226, 232, 240, 0.6);
        color: #0f172a;
        border-bottom-left-radius: 4px;
      }

      .chatbot-message-success .chatbot-message-content {
        background: rgba(16, 185, 129, 0.1);
        border-left: 3px solid #10b981;
      }

      .chatbot-message-error .chatbot-message-content {
        background: rgba(239, 68, 68, 0.1);
        border-left: 3px solid #ef4444;
      }

      .chatbot-message-time {
        font-size: 0.7rem;
        color: #94a3b8;
        padding: 0 4px;
      }

      /* Typing Indicator */
      .chatbot-typing {
        align-items: flex-start;
      }

      .chatbot-typing-dots {
        display: flex;
        gap: 4px;
        padding: 12px 16px;
        background: rgba(226, 232, 240, 0.6);
        border-radius: 18px;
        border-bottom-left-radius: 4px;
      }

      .chatbot-typing-dots span {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #64748b;
        animation: typingDot 1.4s infinite ease-in-out;
      }

      .chatbot-typing-dots span:nth-child(2) {
        animation-delay: 0.2s;
      }

      .chatbot-typing-dots span:nth-child(3) {
        animation-delay: 0.4s;
      }

      @keyframes typingDot {
        0%, 60%, 100% {
          transform: translateY(0);
          opacity: 0.5;
        }
        30% {
          transform: translateY(-8px);
          opacity: 1;
        }
      }

      /* Input Container */
      .chatbot-input-container {
        padding: 20px 24px;
        border-top: 1px solid rgba(226, 232, 240, 0.8);
        display: flex;
        gap: 12px;
        align-items: center;
        background: rgba(248, 250, 252, 0.5);
        border-radius: 0 0 24px 24px;
      }

      .chatbot-input {
        flex: 1;
        padding: 12px 16px;
        border: 1px solid rgba(226, 232, 240, 0.8);
        border-radius: 12px;
        font-size: 0.9rem;
        font-family: inherit;
        background: white;
        color: #0f172a;
        outline: none;
        transition: all 0.2s;
      }

      .chatbot-input:focus {
        border-color: #6366f1;
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
      }

      .chatbot-send-btn {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        border: none;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }

      .chatbot-send-btn:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
      }

      .chatbot-send-btn:active {
        transform: scale(0.95);
      }

      .chatbot-send-btn svg {
        width: 20px;
        height: 20px;
      }

      /* Mobile Responsive */
      @media (max-width: 768px) {
        .chatbot-container {
          bottom: 16px;
          right: 16px;
        }

        .chatbot-window {
          width: calc(100vw - 32px);
          height: calc(100vh - 100px);
          max-height: calc(100vh - 100px);
          bottom: 80px;
          right: 0;
        }

        .chatbot-toggle-btn {
          width: 56px;
          height: 56px;
        }

        .chatbot-icon {
          width: 32px;
          height: 32px;
        }
      }

      /* Dark mode support */
      @media (prefers-color-scheme: dark) {
        .chatbot-window {
          background: rgba(30, 41, 59, 0.98);
          border-color: rgba(51, 65, 85, 0.8);
        }

        .chatbot-header {
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15));
          border-color: rgba(51, 65, 85, 0.8);
        }

        .chatbot-title {
          color: #f1f5f9;
        }

        .chatbot-subtitle {
          color: #94a3b8;
        }

        .chatbot-message-bot .chatbot-message-content {
          background: rgba(51, 65, 85, 0.6);
          color: #f1f5f9;
        }

        .chatbot-input {
          background: rgba(30, 41, 59, 0.8);
          border-color: rgba(51, 65, 85, 0.8);
          color: #f1f5f9;
        }

        .chatbot-input-container {
          background: rgba(15, 23, 42, 0.5);
          border-color: rgba(51, 65, 85, 0.8);
        }
      }

      /* Choice Buttons */
      .chatbot-choices {
        margin: 16px 0;
        animation: messageSlideIn 0.3s ease-out;
      }

      .chatbot-choices-title {
        font-size: 0.85rem;
        color: #64748b;
        margin-bottom: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .chatbot-choices-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
      }

      .chatbot-choice-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 16px;
        background: white;
        border: 1.5px solid rgba(226, 232, 240, 0.8);
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        font-size: 0.85rem;
        font-weight: 600;
        color: #1e293b;
        text-align: left;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      }

      .chatbot-choice-btn:hover {
        background: linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.05));
        border-color: #6366f1;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
      }

      .chatbot-choice-btn:active {
        transform: translateY(0);
      }

      .chatbot-choice-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
      }

      .chatbot-choice-btn svg {
        width: 18px;
        height: 18px;
        flex-shrink: 0;
        color: #6366f1;
      }

      .chatbot-choice-btn-selected {
        background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15)) !important;
        border: 2px solid #6366f1 !important;
        box-shadow: 
          0 4px 12px rgba(99, 102, 241, 0.25),
          0 0 0 3px rgba(99, 102, 241, 0.1) !important;
        transform: translateY(-2px);
        position: relative;
      }

      .chatbot-choice-btn-selected::before {
        content: '';
        position: absolute;
        top: -2px;
        left: -2px;
        right: -2px;
        bottom: -2px;
        background: linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899);
        border-radius: 14px;
        z-index: -1;
        opacity: 0.3;
        animation: borderGlow 2s ease-in-out infinite;
      }

      @keyframes borderGlow {
        0%, 100% {
          opacity: 0.3;
        }
        50% {
          opacity: 0.5;
        }
      }

      .chatbot-choice-btn-selected svg {
        color: #6366f1 !important;
        filter: drop-shadow(0 0 4px rgba(99, 102, 241, 0.5));
      }

      .chatbot-choice-btn-small {
        padding: 10px 14px;
        font-size: 0.8rem;
        justify-content: center;
      }

      .chatbot-level-choices {
        margin: 16px 0;
        animation: messageSlideIn 0.3s ease-out;
      }

      /* Mobile responsive for choices */
      @media (max-width: 768px) {
        .chatbot-choices-grid {
          grid-template-columns: 1fr;
        }
      }

      /* Completion Percentage Styling */
      .chatbot-message-percentage .chatbot-message-content {
        background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1));
        border: 2px solid rgba(99, 102, 241, 0.3);
        padding: 24px 32px;
        text-align: center;
      }

      .chatbot-percentage-display {
        font-size: 3rem;
        font-weight: 800;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        letter-spacing: -0.02em;
        line-height: 1.2;
        margin: 8px 0;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Show choice buttons
   */
  private showChoiceButtons(): void {
    const messagesContainer = document.getElementById("chatbot-messages");
    if (!messagesContainer) return;

    // Remove existing choice buttons if any
    const existingChoices = messagesContainer.querySelector(".chatbot-choices");
    if (existingChoices) {
      existingChoices.remove();
    }

    const choicesDiv = document.createElement("div");
    choicesDiv.className = "chatbot-choices";
    choicesDiv.innerHTML = `
      <div class="chatbot-choices-title">What would you like to do?</div>
      <div class="chatbot-choices-grid">
        <button class="chatbot-choice-btn" data-choice="show-completed">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
          <span>Show Completed Work</span>
        </button>
        <button class="chatbot-choice-btn" data-choice="show-in-progress">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
          </svg>
          <span>Show In-Progress Work</span>
        </button>
        <button class="chatbot-choice-btn" data-choice="show-both">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
          <span>Show Both</span>
        </button>
        <button class="chatbot-choice-btn" data-choice="completion-percentage">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
            <line x1="12" y1="22.08" x2="12" y2="12"/>
          </svg>
          <span>Completion Percentage</span>
        </button>
        <button class="chatbot-choice-btn" data-choice="reset-all">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          <span>Reset All</span>
        </button>
        <button class="chatbot-choice-btn" data-choice="view-by-level">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span>View by Level</span>
        </button>
      </div>
    `;

    messagesContainer.appendChild(choicesDiv);
    this.scrollToBottom();

    // Add click handlers
    const choiceButtons = choicesDiv.querySelectorAll(".chatbot-choice-btn");
    choiceButtons.forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const button = e.currentTarget as HTMLButtonElement;
        const choice = button.getAttribute("data-choice");
        if (!choice) return;

        // Remove selected state from all buttons
        choiceButtons.forEach(b => {
          (b as HTMLButtonElement).classList.remove("chatbot-choice-btn-selected");
        });

        // Add selected state to clicked button
        button.classList.add("chatbot-choice-btn-selected");

        // Disable all buttons during processing
        choiceButtons.forEach(b => (b as HTMLButtonElement).disabled = true);

        // Handle special case for "view-by-level"
        if (choice === "view-by-level") {
          this.showLevelChoices();
          choiceButtons.forEach(b => (b as HTMLButtonElement).disabled = false);
          return;
        }

        // Map choice to command text
        const commandMap: Record<string, string> = {
          "show-completed": "show completed work",
          "show-in-progress": "show in progress work",
          "show-both": "show both",
          "completion-percentage": "completion percentage",
          "reset-all": "reset all"
        };

        const commandText = commandMap[choice];
        if (!commandText) return;

        // Add user message showing the choice
        this.addUserMessage(button.textContent?.trim() || commandText);

        // Show typing indicator
        const typingId = this.addTypingIndicator();

        try {
          // Process command
          const result = await this.controller.processInput(commandText);

          // Remove typing indicator
          this.removeMessage(typingId);

          // Add bot response
          this.addBotMessage(result.message, result);

          // Re-enable buttons and keep them visible with selection
          choiceButtons.forEach(b => (b as HTMLButtonElement).disabled = false);
        } catch (error) {
          console.error("[ChatbotUI] Error processing choice:", error);
          this.removeMessage(typingId);
          this.addBotMessage("Sorry, something went wrong. Please try again.", {
            success: false,
            message: "Error occurred",
            commandType: "unknown",
          });
          // Re-enable buttons
          choiceButtons.forEach(b => (b as HTMLButtonElement).disabled = false);
        }
      });
    });
  }

  /**
   * Show level choice buttons
   */
  private showLevelChoices(): void {
    const messagesContainer = document.getElementById("chatbot-messages");
    if (!messagesContainer) return;

    // Check if level choices already exist - if so, don't recreate them
    const existingLevelChoices = messagesContainer.querySelector(".chatbot-level-choices");
    if (existingLevelChoices) {
      // Just scroll to them if they already exist
      this.scrollToBottom();
      return;
    }

    const levelChoicesDiv = document.createElement("div");
    levelChoicesDiv.className = "chatbot-level-choices";
    levelChoicesDiv.innerHTML = `
      <div class="chatbot-choices-title">Select a Level:</div>
      <div class="chatbot-choices-grid">
        <button class="chatbot-choice-btn chatbot-choice-btn-small" data-level="Basement">Basement</button>
        <button class="chatbot-choice-btn chatbot-choice-btn-small" data-level="Ground">Ground</button>
        <button class="chatbot-choice-btn chatbot-choice-btn-small" data-level="First Floor">First Floor</button>
        <button class="chatbot-choice-btn chatbot-choice-btn-small" data-level="Second Floor">Second Floor</button>
        <button class="chatbot-choice-btn chatbot-choice-btn-small" data-level="Roof">Roof</button>
      </div>
    `;

    messagesContainer.appendChild(levelChoicesDiv);
    this.scrollToBottom();

    // Add click handlers for level buttons
    const levelButtons = levelChoicesDiv.querySelectorAll(".chatbot-choice-btn");
    levelButtons.forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const button = e.currentTarget as HTMLButtonElement;
        const level = button.getAttribute("data-level");
        if (!level) return;

        // Remove selected state from all level buttons
        levelButtons.forEach(b => {
          (b as HTMLButtonElement).classList.remove("chatbot-choice-btn-selected");
        });

        // Add selected state to clicked button
        button.classList.add("chatbot-choice-btn-selected");

        // Disable all buttons during processing
        levelButtons.forEach(b => (b as HTMLButtonElement).disabled = true);

        // Add user message
        this.addUserMessage(`Show ${level}`);

        // Show typing indicator
        const typingId = this.addTypingIndicator();

        try {
          // Process command - use just the level name (handler keywords will match it)
          const result = await this.controller.processInput(level);

          // Remove typing indicator
          this.removeMessage(typingId);

          // Add bot response
          this.addBotMessage(result.message, result);

          // Re-enable buttons and keep level choices visible with selection
          levelButtons.forEach(b => (b as HTMLButtonElement).disabled = false);
        } catch (error) {
          console.error("[ChatbotUI] Error processing level choice:", error);
          this.removeMessage(typingId);
          this.addBotMessage("Sorry, something went wrong. Please try again.", {
            success: false,
            message: "Error occurred",
            commandType: "unknown",
          });
          // Re-enable buttons
          levelButtons.forEach(b => (b as HTMLButtonElement).disabled = false);
        }
      });
    });
  }


  /**
   * Dispose and clean up
   */
  public dispose(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this.messages = [];
    this.isOpen = false;
  }
}


