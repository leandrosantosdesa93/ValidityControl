type EventCallback = () => void;

class EventEmitter {
  private listeners: { [key: string]: EventCallback[] } = {};

  subscribe(event: string, callback: EventCallback): () => void {
    console.log('[EventEmitter] Novo subscriber para:', event);
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);

    // Retorna função para remover o listener
    return () => {
      console.log('[EventEmitter] Removendo subscriber de:', event);
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  emit(event: string) {
    console.log('[EventEmitter] Emitindo evento:', event);
    if (this.listeners[event]) {
      const callbacks = this.listeners[event];
      callbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error('[EventEmitter] Erro ao executar callback:', error);
        }
      });
      console.log('[EventEmitter] Evento processado:', event, 'Callbacks executados:', callbacks.length);
    } else {
      console.log('[EventEmitter] Nenhum listener para o evento:', event);
    }
  }

  clearListeners(event?: string) {
    if (event) {
      console.log('[EventEmitter] Limpando listeners do evento:', event);
      this.listeners[event] = [];
    } else {
      console.log('[EventEmitter] Limpando todos os listeners');
      this.listeners = {};
    }
  }
}

export const eventEmitter = new EventEmitter();

export const PRODUCT_EVENTS = {
  UPDATED: 'PRODUCT_UPDATED',
  CREATED: 'PRODUCT_CREATED',
  DELETED: 'PRODUCT_DELETED'
}; 