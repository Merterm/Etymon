# coding=utf-8
from bs4 import BeautifulSoup
import unicodecsv as csv
import os

#Open a csv file to write all words and their etymologies
csvfile = open('starling_etymologies.csv', 'wb')
csvwriter = csv.writer(csvfile, delimiter=';')
csvwriter.writerow(['language family','word','etymology'])
csvfile.close()

dirct = "../../../data/starling/"

cnt = 0
for folder in os.listdir(dirct):
    #try:
        #Iterate over every html document in directory
    for html in os.listdir(dirct + str(folder) + "/"):
        #print str(html)
        #try:
        #Open HTML file
        html_file = open(dirct + str(folder) + "/" + html.decode('utf-8'), "r")
        content = html_file.read()
        soup = BeautifulSoup(content.decode('utf-8'), 'html.parser')

        #Find the records
        records = soup.find_all("div", class_="results_record")
        #print type(records[0])

        for record in records:
            cnt = cnt + 1
            conts = record.contents
            print conts

            #Find language family
            family = conts[1].find("font", color="green").string

            #Find the word
            word = conts[1].find(class_="unicode").string
            #print word

            #Find the etymologies
            etymology = []
            for i in range(2,len(conts)-1):
                text = conts[i].find(class_="fld").string
                if (text == "Meaning:") or (text == "Russian meaning:") or \
                (text == "Comments:") or (text == "Reference :") or (text == "Meaning :") \
                or (text == "References:") or (text == "Russ. meaning:") \
                or (text == "K. Reshetnikov's notes:") or (text == "K. Redei's notes:") \
                or (text == "German meaning:") or (text == "Notes and references:") \
                or (text == "Notes :") or (text == "Additional forms :"):
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
            csvwriter.writerow([family, word, etymology])
            csvfile.close()

        html_file.close()
        #except:
        #    print "passing " + str(html)
    #except:
    #    print "passing " + str(folder)

print "Total word count: " + str(cnt)
