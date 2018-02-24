# coding=utf-8
from bs4 import BeautifulSoup
import unicodecsv as csv
import os

#Open a csv file to write all words and their etymologies
csvfile = open('starling_etymologies.csv', 'wb')
csvwriter = csv.writer(csvfile, delimiter=';')
csvwriter.writerow(['word','etymology'])
csvfile.close()

cnt = 0
#Iterate over every html document in directory
for html in os.listdir("../data/starling/Turkic Etymology/"):
    print str(html)
    try:
        #Open HTML file
        html_file = open("../data/starling/Turkic Etymology/" + html.decode('utf-8'), "r")
        content = html_file.read()
        soup = BeautifulSoup(content.decode('utf-8'), 'html.parser')

        #Find the records
        records = soup.find_all("div", class_="results_record")

        for record in records:
            conts = record.contents

            #Find the word
            word = conts[0].find(class_="unicode").string
            #print word

            #Find the etymologies
            etymology = []
            for i in range(2,len(conts)-1):
                text = conts[i].find(class_="fld").string
                if (text == "Meaning:") or (text == "Russian meaning:") or \
                (text == "Comments:"):
                    pass
                else:
                    unic = conts[i].find(class_="unicode").string
                    if not unic:
                        etymology.append( (text, conts[i].find(class_="unicode").contents) )
                    else:
                        etymology.append((text, unic))

            #Write to CSV
            csvfile = open('starling_etymologies.csv', 'ab')
            csvwriter = csv.writer(csvfile, delimiter=';')
            csvwriter.writerow([word, etymology])
            csvfile.close()

        html_file.close()
    except:
        print "passing " + str(html)
