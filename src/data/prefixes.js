import * as financialSuccess from './categories/financialSuccess.js';
import * as games from './categories/games.js';
import * as success from './categories/success.js';
import * as positive from './categories/positive.js';

const categoryPrefixes = {
  'default': ['my', 'the', 'go', 'get', 'super', 'ultra', 'mega', 'power'],
  'tech': ['tech', 'smart', 'cyber', 'digital', 'nextgen', 'auto', 'quantum', 'neuro', 'crypto'],
  'food': ['taste', 'yum', 'chef', 'foodie', 'bite', 'grub', 'savor', 'delish', 'gourmet'],
  'fashion': ['style', 'vogue', 'trend', 'glam', 'chic', 'couture', 'dapper', 'sleek', 'fancy'],
  'occupation': ['pro', 'master', 'expert', 'chief', 'lead', 'senior', 'certified', 'vetted', 'skilled'],
  'animal': ['wild', 'pet', 'paw', 'tail', 'furry', 'sly', 'tame', 'beast', 'roar'],
  'place': ['local', 'global', 'city', 'village', 'metro', 'urban', 'rural', 'hidden', 'known'],
  'measure': ['metric', 'score', 'rate', 'scale', 'quant', 'gauge', 'index', 'ratio', 'norm'],
  'character': ['hero', 'champion', 'legend', 'villain', 'saint', 'rogue', 'martyr', 'tycoon', 'pioneer'],
  'tech_term': ['code', 'dev', 'net', 'data', 'cloud', 'pixel', 'binary', 'logic', 'circuit'],
  'utility': ['tool', 'app', 'service', 'hub', 'solution', 'system', 'utility', 'machine', 'resource'],
  'formal_group': ['team', 'squad', 'group', 'agency', 'assembly', 'crew', 'collective', 'syndicate', 'guild'],
  'formal_gathering': ['club', 'conference', 'summit', 'convention', 'rally', 'symposium', 'seminar', 'conclave', 'gathering'],
  'value_adjective': ['best', 'top', 'prime', 'fine', 'elite', 'premier', 'supreme', 'optimal', 'peak'],
  'value_adverb': ['fast', 'easy', 'quick', 'rapid', 'smooth', 'clear', 'sharp', 'bright', 'solid'],
  'time': ['now', 'today', 'future', 'moment', 'forever', 'always', 'never', 'past', 'present'],
  'innovation': ['innova', 'gen', 'pioneer', 'neo', 'future', 'vanguard', 'visionary', 'trailblazer', 'avant'],
  'entertainment': ['fun', 'game', 'play', 'show', 'drama', 'fan', 'star', 'cinema', 'stage'],
  'finance': ['cash', 'wealth', 'rich', 'fund', 'pay', 'profit', 'bank', 'save', 'stock'],
  'health': ['fit', 'well', 'pure', 'heal', 'cure', 'revive', 'whole', 'fresh', 'vital'],
  'action': [
    'join', 'discover', 'explore', 'start', 'get', 'save', 'buy', 'book',
    'claim', 'try', 'find', 'grab', 'unlock', 'boost', 'make', 'build',
    'create', 'learn', 'ask', 'call', 'go'
  ],
  financialSuccess: financialSuccess.categoryPrefixes,
  positive: positive.categoryPrefixes,
  games: games.categoryPrefixes,
  success: success.categoryPrefixes,
};

export default categoryPrefixes;