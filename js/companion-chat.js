import { blocks as BL } from './world/blocks.js';
import { items } from './inventory/items.js';

const SYSTEM = `You are Moss, the player's friendly Minecraft world companion. You are physically present in their world as a blocky Steve-like player. Talk like a playful, capable teammate, in short natural sentences. Remember what the player says. You usually follow them while keeping several blocks of space between you. When they ask you to do something in the world, use your tools to do it and describe what you actually did or are doing. Never claim an action succeeded unless its tool says it did. You can walk to a nearby spot, follow the player, mine a nearby block, and place one of your own carried blocks. You cannot see beyond the supplied world snapshot. Don't pretend to have abilities you do not have.`;

export class CompanionChat {
  constructor(game) {
    this.game = game;
    this.busy = false;
    this.pending = [];
    this.recognition = null;
    this.voiceChat = false;
    this.speaking = false;
    this.turns = [];
    this.actor = null;
    this.welcomed = false;
    this.setupRecognition();
  }

  setupRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = event => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (!event.results[i].isFinal) continue;
        const text = event.results[i][0]?.transcript?.trim();
        if (!text) continue;
        this.game.addChat(`<${this.game.username || 'Player'}> ${text}`, '#ffffff');
        this.receive(text);
      }
    };
    recognition.onerror = event => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.voiceChat = false;
        this.game.addChat('Moss: Microphone access was blocked. Allow microphone access, then type /vc to try again.', '#b8d67a');
      }
    };
    recognition.onend = () => {
      if (!this.voiceChat || this.speaking || !this.game.world || !this.game.companion) return;
      try { recognition.start(); } catch (_) {}
    };
    this.recognition = recognition;
  }

  enterWorld() {
    if (!this.welcomed) {
      this.welcomed = true;
      this.say('Hey! I’m Moss. Talk to me in chat. Type /vc to enable voice chat, talk with your mic, and hear me reply.', false);
    }
  }

  leaveWorld() {
    this.voiceChat = false;
    try { this.recognition?.stop(); } catch (_) {}
    this.actor = null;
    this.turns = [];
    this.welcomed = false;
  }

  toggleVoiceChat() {
    if (!this.recognition) {
      this.game.addChat('Voice chat is not supported in this browser.', '#ffcc55');
      return;
    }
    if (this.voiceChat) {
      this.voiceChat = false;
      this.recognition.stop();
      this.game.addChat('Moss voice chat disabled.', '#b8d67a');
      return;
    }
    this.voiceChat = true;
    try {
      this.recognition.start();
      this.game.addChat('Moss voice chat enabled. Talk into your mic; Moss will answer out loud. Type /vc again to turn it off.', '#b8d67a');
    } catch (_) {
      this.voiceChat = false;
      this.game.addChat('Could not start the microphone. Check browser mic permission and try /vc again.', '#ffcc55');
    }
  }

  say(text, speak = true) {
    this.game.addChat(`<Moss> ${text}`, '#b8d67a');
    if (speak && this.voiceChat && window.websim?.textToSpeech) {
      this.speaking = true;
      try { this.recognition?.stop(); } catch (_) {}
      window.websim.textToSpeech({ text, voice: 'en-female' }).catch(() => {}).finally(() => {
        this.speaking = false;
        if (this.voiceChat) {
          try { this.recognition?.start(); } catch (_) {}
        }
      });
    }
  }

  receive(text) { this.ask(text); }

  async getActor() {
    if (this.actor) return this.actor;
    if (!window.websim?.agent?.create) throw new Error('The companion connection is unavailable.');
    this.actor = await window.websim.agent.create({
      instructions: SYSTEM,
      maxSteps: 4,
      reasoning: false,
      tools: {
        follow_player: {
          description: 'Stop the current task and follow the player again.',
          parameters: { type: 'object', properties: {}, additionalProperties: false },
          execute: async () => {
            this.game.companion?.follow();
            return { following: true };
          },
        },
        mine_nearby_log: {
          description: 'Walk over and mine the nearest nearby tree log listed in the world snapshot. Use this when asked to get wood.',
          parameters: { type: 'object', properties: {}, additionalProperties: false },
          execute: async () => {
            const log = this.game.companion?.nearbyLogs(10)[0];
            if (!log) return { ok: false, message: 'I cannot find a nearby tree log.' };
            return this.game.companion.mineBlock(log.x, log.y, log.z);
          },
        },
        mine_block: {
          description: 'Walk over and mine a specific nearby block using its coordinates from the world snapshot.',
          parameters: {
            type: 'object',
            properties: { x: { type: 'integer' }, y: { type: 'integer' }, z: { type: 'integer' } },
            required: ['x', 'y', 'z'],
            additionalProperties: false,
          },
          execute: async ({ x, y, z }) => {
            const p = this.game.player;
            if (Math.hypot(x + .5 - p.x, y + .5 - p.y, z + .5 - p.z) > 14) return { ok: false, message: 'That block is too far away.' };
            return this.game.companion.mineBlock(x, y, z);
          },
        },
        walk_to: {
          description: 'Walk to a nearby spot when the player asks you to go somewhere.',
          parameters: {
            type: 'object',
            properties: { x: { type: 'number' }, z: { type: 'number' } },
            required: ['x', 'z'],
            additionalProperties: false,
          },
          execute: async ({ x, z }) => {
            const p = this.game.player;
            if (Math.hypot(x - p.x, z - p.z) > 14) return { ok: false, message: 'That spot is too far from the player.' };
            this.game.companion.goTo(x, z);
            return { ok: true, message: 'On my way.' };
          },
        },
        place_block: {
          description: 'Place one of your carried full blocks at a clear nearby position. Use a block id from the companion inventory snapshot.',
          parameters: {
            type: 'object',
            properties: {
              x: { type: 'integer' }, y: { type: 'integer' }, z: { type: 'integer' },
              blockId: { type: 'integer' },
            },
            required: ['x', 'y', 'z', 'blockId'],
            additionalProperties: false,
          },
          execute: async ({ x, y, z, blockId }) => this.game.companion.placeBlock(x, y, z, blockId),
        },
      },
    });
    return this.actor;
  }

  worldSnapshot() {
    const g = this.game, p = g.player, c = g.companion;
    if (!p || !c || !g.world) return 'The player world is not loaded.';
    const inventory = c.body.inv.slots.filter(Boolean).map(s => `${BL[items[s.id]?.block]?.name || items[s.id]?.name || s.id} (id ${s.id}) x${s.count}`);
    const nearbyMobs = g.mobs.mobs.filter(m => !m.dead && Math.hypot(m.x - p.x, m.z - p.z) < 10)
      .slice(0, 5).map(m => m.type).join(', ') || 'none';
    const logs = c.nearbyLogs().map(b => `${b.name} at ${b.x},${b.y},${b.z}`).join('; ') || 'none';
    return `World snapshot: player at ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}; you at ${c.body.x.toFixed(1)}, ${c.body.y.toFixed(1)}, ${c.body.z.toFixed(1)}; time ${g.time}; nearby hostile or passive creatures: ${nearbyMobs}; nearby tree logs within 10 blocks: ${logs}; your inventory: ${inventory.join(', ') || 'empty'}; current task: ${c.order.mode}${c.order.mode === 'mine' ? ` block at ${c.order.x},${c.order.y},${c.order.z}` : ''}.`;
  }

  async ask(text) {
    if (this.busy) { this.pending.push(text); return; }
    this.busy = true;
    try {
      const actor = await this.getActor();
      const messages = this.turns.flatMap(turn => turn);
      messages.push({ role: 'user', content: `${this.worldSnapshot()}\n\nThe player says: ${text}` });
      const result = await actor.generate({ messages });
      const responseMessages = result.response?.messages || [];
      let reply = typeof result.text === 'string' ? result.text.trim() : '';
      if (!reply) {
        const last = [...responseMessages].reverse().find(m => m.role === 'assistant');
        const content = last?.content;
        reply = typeof content === 'string' ? content.trim() : Array.isArray(content) ? content.map(part => part.text || '').join('').trim() : '';
      }
      if (!reply) reply = 'I’m here with you.';
      this.turns.push([{ role: 'user', content: text }, ...responseMessages]);
      this.turns = this.turns.slice(-6);
      this.say(reply);
    } catch (error) {
      console.warn('Companion reply failed', error);
      const code = error?.code || error?.name;
      const message = code === 'sign_in_required'
        ? 'I need a signed-in Websim session before I can answer.'
        : code === 'credits_required'
          ? 'I’m out of AI credits for now.'
          : code === 'rate_limited'
            ? 'I need a short breather. Try me again soon.'
            : 'I lost the connection for a moment. Try me again?';
      this.say(message, false);
    } finally {
      this.busy = false;
      if (this.pending.length) this.ask(this.pending.shift());
    }
  }

}
