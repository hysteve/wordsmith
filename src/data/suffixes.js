import * as financialSuccess from './categories/financialSuccess.js';
import * as games from './categories/games.js';
import * as success from './categories/success.js';
import * as positive from './categories/positive.js';

const categorySuffixes = {
  'default': ['hub', 'site', 'zone', 'base', 'web', 'point', 'port', 'box'],
  'tech': ['zone', 'base', 'network', 'lab', 'tech', 'byte', 'data', 'cloud'],
  'food': ['plate', 'feast', 'kitchen', 'grill', 'bite', 'bake', 'chef', 'pantry'],
  'fashion': ['wear', 'boutique', 'fashion', 'look', 'style', 'glam', 'trend', 'couture'],
  'occupation': ['chef', 'doctor', 'driver', 'pilot', 'builder', 'teacher', 'engineer', 'nurse'],
  'animal': [
    'wolf', 'fox', 'owl', 'bear', 'eagle', 'hawk', 'shark', 'whale',
    'dolphin', 'penguin', 'cheetah', 'leopard', 'panther', 'tiger',
    'lion', 'elephant', 'rhino', 'hippo', 'giraffe', 'zebra',
    'cobra', 'viper', 'python', 'falcon', 'raptor', 'orca',
    'lynx', 'jaguar', 'crocodile', 'alligator', 'dragon', 'phoenix',
    'unicorn', 'griffin', 'sphinx', 'pegasus', 'yeti', 'sasquatch',
    'kraken', 'mammoth', 'direwolf', 'minotaur', 'chimera', 'cerberus',
    'manticore', 'wyvern', 'serpent', 'beast', 'mutant', 'sprite',
    'nymph', 'leviathan', 'hydra', 'grizzly', 'bison', 'buffalo',
    'racoon', 'badger', 'otter', 'mongoose', 'meerkat', 'armadillo',
    'skunk', 'sloth', 'anteater', 'dingo', 'jackal', 'caracal',
    'lynx', 'quokka', 'wombat', 'koala', 'kangaroo', 'wallaby'
  ],
  'place': ['park', 'plaza', 'avenue', 'lane', 'place', 'spot', 'location', 'area'],
  'measure': ['meter', 'scale', 'score', 'metrics', 'gauge', 'index', 'level', 'rating'],
  'character': ['king', 'queen', 'knight', 'warrior', 'sage', 'wizard', 'pirate', 'ninja'],
  'tech_term': ['tech', 'byte', 'code', 'system', 'stack', 'cloud', 'network', 'database'],
  'utility': ['tool', 'app', 'service', 'platform', 'suite', 'engine', 'helper', 'utility'],
  'formal_group': ['squad', 'team', 'group', 'agency', 'assembly', 'crew', 'collective', 'organization'],
  'formal_gathering': ['club', 'conference', 'summit', 'meet', 'session', 'conclave', 'symposium', 'forum'],
  'value_adjective': ['best', 'top', 'prime', 'supreme', 'ultimate', 'major', 'leading', 'premier'],
  'value_adverb': ['fast', 'easy', 'quick', 'rapid', 'smooth', 'soon', 'direct', 'swift'],
  'time': ['now', 'today', 'future', 'moment', 'eternal', 'age', 'era', 'epoch'],
  'entertainment': ['show', 'scene', 'stage', 'play', 'cinema', 'studio', 'drama', 'spotlight'],
  'finance': ['bank', 'capital', 'money', 'fund', 'stock', 'trade', 'wealth', 'invest'],
  'health': ['care', 'cure', 'well', 'clinic', 'body', 'mind', 'health', 'med'],
  'education': ['edu', 'learn', 'school', 'class', 'course', 'academy', 'study', 'knowledge'],
  'real_estate': ['home', 'property', 'estate', 'realty', 'land', 'house', 'place', 'villa'],
  'travel': ['trip', 'tour', 'journey', 'voyage', 'travel', 'explore', 'adventure', 'destination'],
  'action': [
    'now', 'today', 'here', 'online', 'pro', 'expert', 'fast', 'easy',
    'top', 'best', 'quick', 'save', 'deal', 'offer', 'sale', 'hub', 'shop',
    'store', 'mart', 'plus', 'direct'
  ],
  financialSuccess: financialSuccess.categorySuffixes,
  positive: positive.categorySuffixes,
  games: games.categorySuffixes,
  success: success.categorySuffixes,
};

export default categorySuffixes;