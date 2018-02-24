# coding=utf-8
from bs4 import BeautifulSoup
import unicodecsv as csv
import os

#Open a csv file to write all words and their etymologies
csvfile = open('nisanyan_etymologies.csv', 'wb')
csvwriter = csv.writer(csvfile, delimiter=';')
csvwriter.writerow(['word','etymology','related'])
csvfile.close()

cnt = 0
#Iterate over every html document in directory
for html in os.listdir("../data/Nisanyan/"):
    #try:
    #for display purposes
    #if cnt % 1000 == 0:
    #    print "***" + str(cnt) + "***"
    #cnt = cnt + 1
    #Open HTML file
    html_file = open("../data/Nisanyan/" + html.decode('utf-8'), "r")
    content = html_file.read()
    soup = BeautifulSoup(content.decode('utf-8'), 'html.parser')

    #Find the word
    word = soup.find("a").string

    #Find the etymology
    definitions = str(soup.find_all("div", class_="blmbasi")[1].parent.contents[3])

    #Find all related words
    row_cnt = 2
    row3 = soup.find_all("div", class_="blmbasi")
    related = ""
    print word
    print row3
    print len(row3)
    while (row_cnt < len(row3)-1) and (row3[row_cnt].text.encode('utf-8').decode('utf-8') != u'Benzer sözcükler'):
        print row_cnt
        row_cnt = row_cnt + 1
        related = str(soup.find_all("div", class_="blmbasi")[row_cnt].parent.contents[3])

    html_file.close()

    #Write to CSV
    csvfile = open('nisanyan_etymologies.csv', 'ab')
    csvwriter = csv.writer(csvfile, delimiter=';')
    csvwriter.writerow([word, definitions, related])
    csvfile.close()
    #except:
        #print "passing " + str(html)
