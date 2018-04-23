import numpy
import argparse
import os
import sys
from keras.models import Sequential
from keras.layers import Dense
from keras.layers import Dropout
from keras.layers import LSTM
from keras.callbacks import ModelCheckpoint
from keras.utils import np_utils
from tensorflow.contrib.training.python.training import hparam
from tensorflow.python.lib.io import file_io

# h5py workaround: copy local models over to GCS if the job_dir is GCS.
def copy_file_to_gcs(job_dir, file_path):
  with file_io.FileIO(file_path, mode='r') as input_f:
    with file_io.FileIO(os.path.join(job_dir, file_path), mode='w+') as output_f:
        output_f.write(input_f.read())


# Input Arguments
parser = argparse.ArgumentParser()
parser.add_argument(
	'--filename',
	help='name of the training file',
	nargs='+',
	required=True
)
parser.add_argument(
	'--job-dir',
	help='location to write checkpoints and export models',
	required=True
)

args = parser.parse_args()
hparams=hparam.HParams(**args.__dict__)
print hparams.filename[0]
filename = hparams.filename[0]
#filename = "etymwn.tsv"
job_dir = hparams.job_dir

# 1.  Prepare the data
# load ascii text and convert to lowercase
file_stream = file_io.FileIO(filename, mode='r')
raw_text = ""
while True:
	try:
		raw_text = raw_text + next(file_stream)
	except StopIteration:
		break
raw_text = raw_text.lower()

#print raw_text
# create mapping of unique chars to integers
chars = sorted(list(set(raw_text)))
char_to_int = dict((c, i) for i, c in enumerate(chars))

n_chars = len(raw_text)
n_vocab = len(chars)
print "Total Characters: ", n_chars
print "Total Vocab: ", n_vocab

# prepare the dataset of input to output pairs encoded as integers
seq_length = 40
dataX = []
dataY = []
for i in range(0, n_chars - seq_length, 1):
	if (i%1000000 == 0):
		sys.stdout.write(str(i/1000000) + ' million done\r')
		sys.stdout.flush()
	seq_in = raw_text[i:i + seq_length]
	seq_out = raw_text[i + seq_length]
	dataX.append([char_to_int[char] for char in seq_in])
	dataY.append(char_to_int[seq_out])
n_patterns = len(dataX)
print "Total Patterns: ", n_patterns

# reshape X to be [samples, time steps, features]
print "Before reshape"
X = numpy.reshape(dataX, (n_patterns, seq_length, 1))
print "After reshape"
# normalize
X = X / float(n_vocab)
# one hot encode the output variable
y = np_utils.to_categorical(dataY)

# 2. Create the network
# define the LSTM model
print X.shape[1], X.shape[2]
print y.shape[1]
model = Sequential()
model.add(LSTM(256, input_shape=(X.shape[1], X.shape[2])))
model.add(Dropout(0.2))
model.add(Dense(y.shape[1], activation='softmax'))
model.compile(loss='categorical_crossentropy', optimizer='adam')

# define the checkpoint
filepath = "weights-improvement-{epoch:02d}.hdf5"
try:
  os.makedirs(job_dir)
except:
  pass

# Unhappy hack to work around h5py not being able to write to GCS.
# Force snapshots and saves to local filesystem, then copy them over to GCS.
checkpoint_path = filepath
if not job_dir.startswith("gs://"):
  checkpoint_path = os.path.join(job_dir, checkpoint_path)

# Model checkpoint callback
checkpoint = ModelCheckpoint(checkpoint_path, monitor='loss', verbose=0, save_best_only=True, mode='min')
callbacks_list = [checkpoint]

# 3. Train the network
model.fit(X, y, epochs=20, batch_size=128, callbacks=callbacks_list)

model.save('lstm.h5')

if job_dir.startswith("gs://"):
	copy_file_to_gcs(job_dir,'lstm.h5')
