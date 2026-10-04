// A small bank of short, regular words, sorted by the job they do in a
// sentence. Everything here sounds out the way it is spelled.
export const WORDS = {
  // Who can do things.
  who: ['cat', 'dog', 'pig', 'hen', 'fox', 'bug', 'rat', 'bat', 'ant', 'cub', 'pup', 'kid', 'man', 'duck', 'vet',
    'yak', 'dad', 'mum', 'nan'],
  // Things you can have, get or hit.
  thing: ['map', 'pan', 'pot', 'pin', 'tin', 'cup', 'mug', 'jug', 'bag', 'hat', 'cap', 'net', 'pen', 'peg', 'jam',
    'bun', 'nut', 'fan', 'sock', 'lid', 'bell', 'doll', 'jet', 'wig', 'zip', 'gum', 'pad', 'kit', 'bat', 'bug'],
  // Where something can be.
  place: ['mat', 'bed', 'box', 'bus', 'van', 'hut', 'den', 'tub', 'rug', 'hill', 'rock', 'log', 'mud', 'sun', 'pit',
    'sack', 'bin', 'web', 'fog', 'bag', 'net', 'pan'],
  // Words for how someone feels or is, and words for how a thing looks.
  feeling: ['sad', 'mad', 'big', 'wet', 'hot', 'fit'],
  look: ['big', 'red', 'hot', 'wet', 'dim', 'tan'],
  // "The cat ___ on a mat."
  didAlone: ['sat', 'ran', 'hid', 'dug', 'fell', 'sped'],
  // "Sam ___ a hat."
  didTo: ['had', 'got', 'hit', 'fed', 'met', 'bit', 'cut', 'led', 'hid', 'won'],
  // "A pig can ___."
  canDo: ['run', 'sit', 'hop', 'dig', 'nap', 'jog', 'hum', 'win', 'beg', 'nod', 'yell', 'mop', 'sip',
    'spin', 'stand'],
  where: ['on', 'in', 'at'],
  name: ['Sam', 'Pat', 'Tim', 'Nan', 'Dan', 'Pam', 'Sid', 'Kim', 'Meg', 'Ben', 'Tom', 'Ned', 'Jen', 'Max', 'Zak',
    'Viv', 'Bob', 'Gus', 'Dad', 'Mum'],
  determiner: ['a', 'the'],
};

// Sentence shapes. Each slot names a list above; "=word" is that exact word.
export const SHAPES = [
  ['determiner', 'who', 'didAlone', 'where', 'determiner', 'place'],
  ['name', 'didAlone', 'where', 'determiner', 'place'],
  ['name', 'didTo', 'determiner', 'thing'],
  ['name', 'didTo', 'determiner', 'look', 'thing'],
  ['determiner', 'who', '=can', 'canDo'],
  ['name', '=can', 'canDo', 'where', 'determiner', 'place'],
  ['determiner', 'thing', '=is', 'look'],
  ['determiner', 'who', '=is', 'feeling'],
  ['name', '=is', 'feeling'],
  ['determiner', 'feeling', 'who', 'didAlone'],
  ['name', '=is', 'where', 'determiner', 'place'],
  ['determiner', 'who', '=is', 'where', 'determiner', 'place'],
  ['determiner', 'thing', '=is', 'where', 'determiner', 'place'],
];
