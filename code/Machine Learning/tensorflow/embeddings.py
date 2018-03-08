import numpy as np
import csv

embeddings_index = {}

with open('tr.csv', 'rb') as csvfile:
     values = csv.reader(csvfile, delimiter='\s\s', quotechar='|')
     for row in values:
         print row[0]

f = open('tr.txt')
for line in f:
    values = line.split()
    print values
    word = values[1]
    coefs = np.asarray(values[2:], dtype='float32')
    embeddings_index[word] = coefs
f.close()

print('Found %s word vectors.' % len(embeddings_index))
