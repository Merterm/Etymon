import numpy
from keras.models import Sequential
from keras.layers import Dense
from keras.layers import Dropout
from keras.layers import LSTM
from keras.callbacks import ModelCheckpoint
from keras.utils import np_utils

# 1.  Prepare the data
# load ascii text and convert to lowercase
filename = "etymwn.tsv"
data = open(filename)
raw_text = data.read()
raw_text = raw_text.lower()
data.close()

# create mapping of unique chars to integers
chars = sorted(list(set(raw_text)))
char_to_int = dict((c, i) for i, c in enumerate(chars))

n_chars = len(raw_text)
n_vocab = len(chars)
text_batch_size = 1000;
seq_length = 40

print "Total Characters: ", n_chars
print "Total Vocab: ", n_vocab
print "Batch Size: ", text_batch_size
print "Sequence Length: ", seq_length

# 2. Create the network
# define the LSTM model
model = Sequential()
model.add(LSTM(256, input_shape=(seq_length, 1)))
model.add(Dropout(0.2))
model.add(Dense(30, activation='softmax'))
model.compile(loss='categorical_crossentropy', optimizer='adam')

print n_chars/text_batch_size
batch_no = 0
while batch_no < (n_chars/text_batch_size):
	print batch_no
	start = batch_no * text_batch_size
	end = start + text_batch_size
	batch_raw_text = raw_text[start:end]
	print batch_raw_text, len(batch_raw_text)

	# prepare the dataset of input to output pairs encoded as integers
	dataX = []
	dataY = []
	for i in range(0, text_batch_size - seq_length, 1):
		seq_in = batch_raw_text[i:i + seq_length]
		seq_out = batch_raw_text[i + seq_length]
		dataX.append([char_to_int[char] for char in seq_in])
		dataY.append(char_to_int[seq_out])
	n_patterns = len(dataX)
	print dataY
	print "Total Patterns: ", n_patterns

	# reshape X to be [samples, time steps, features]
	X = numpy.reshape(dataX, (n_patterns, seq_length, 1))
	# normalize
	X = X / float(n_vocab)
	# one hot encode the output variable
	y = np_utils.to_categorical(dataY)
	print y.shape[1]

	# 3. Train the network
	# define the checkpoint
	filepath="weights-improvement-{batch_no:02d}-{epoch:02d}.hdf5"
	checkpoint = ModelCheckpoint(filepath, monitor='loss', verbose=1, save_best_only=True, mode='min')
	callbacks_list = [checkpoint]

	model.fit(X, y, epochs=20, batch_size=128, callbacks=callbacks_list)
	batch_no = batch_no + 1
