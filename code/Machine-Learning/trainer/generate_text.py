import numpy
import sys
from keras.models import Sequential
from keras.layers import Dense
from keras.layers import Dropout
from keras.layers import LSTM
from keras.callbacks import ModelCheckpoint
from keras.utils import np_utils

# 1.  Prepare the data
# load ascii text and convert to lowercase
filename = "etymwn.tsv"
raw_text = open(filename).read()
raw_text = raw_text.lower()

# create mapping of unique chars to integers
chars = sorted(list(set(raw_text)))
char_to_int = dict((c, i) for i, c in enumerate(chars))

n_chars = len(raw_text)
n_vocab = len(chars)
seq_length = 40

# 2. Create the network
# define the LSTM model
model = Sequential()
model.add(LSTM(256, input_shape=(seq_length, 1)))
model.add(Dropout(0.2))
model.add(Dense(n_vocab, activation='softmax'))
model.compile(loss='categorical_crossentropy', optimizer='adam')

# 3. Generate text
# load the network weights
filename = "weights-improvement-20.hdf5"
model.load_weights(filename)
model.compile(loss='categorical_crossentropy', optimizer='adam')

#Reverse int to char
int_to_char = dict((i, c) for i, c in enumerate(chars))

# pick a random seed
seed_start =  "etymology\teng: wort\neng: "
seed_end = 	"\trel:etymology\t"
word = "hello"

min_chars = seq_length - (len(seed_end)+len('eng: '))
print min_chars

# Get the command line arguments
if len(sys.argv) > 1:
	word = sys.argv[1]
	if len(word) <= min_chars:
		template = seed_start
		# Remove characters from seed_start as many as the
		# characters in the word
		for char in word:
			template = template[1:]
		seed = template + word + seed_end
	else:
		seed = seed_start[5:] + word + seed_end
else:
	seed = seed_start[5:] + word + seed_end

print seed
#print dataX[start]
pattern = []
for char in seed:
	pattern.append(char_to_int[char])
#print pattern
print "Seed:"
print "\"",''.join([int_to_char[value] for value in pattern]), "\""
# generate characters
for i in range(len(seed)):
	x = numpy.reshape(pattern, (1, len(pattern), 1))
	x = x / float(n_vocab)
	prediction = model.predict(x, verbose=0)
	index = numpy.argmax(prediction)
	result = int_to_char[index]
	seq_in = [int_to_char[value] for value in pattern]
	sys.stdout.write(result)
	pattern.append(index)
	pattern = pattern[1:len(pattern)]
#print "\nDone."
