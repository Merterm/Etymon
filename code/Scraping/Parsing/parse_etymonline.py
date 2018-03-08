from bs4 import BeautifulSoup
import unicodecsv as csv
import os

#Open a csv file to write all words and their etymologies
csvfile = open('word_etymologies.csv', 'wb')
csvwriter = csv.writer(csvfile, delimiter=';')
csvwriter.writerow(['word','etymology','related'])
csvfile.close()

cnt = 0
#Iterate over every html document in directory
for html in os.listdir("../data/Etymonline/html/"):
    try:
        #for display purposes
        if cnt % 1000 == 0:
            print "***" + str(cnt) + "***"
        cnt = cnt + 1
        #Open HTML file
        html_file = open("../data/Etymonline/html/" + html.decode('utf-8'), "r")
        content = html_file.read()
        soup = BeautifulSoup(content.decode('utf-8'), 'html.parser')

        #Find all word headings
        headings = ""
        for tag in soup.find_all(class_="word__name--TTbAA"):
            headings = headings + '\n' + tag.string

        #Find all definitions
        definitions = ""
        for tag in soup.find_all(class_="word__defination--2q7ZH"):
            definitions = definitions + '\n' + str(tag)

        #Find all related words
        related = str(soup.find("ul", class_="related__container--22iKI"))

        html_file.close()

        #Write to CSV
        csvfile = open('word_etymologies.csv', 'ab')
        csvwriter = csv.writer(csvfile, delimiter=';')
        csvwriter.writerow([headings, definitions, related])
        csvfile.close()
    except:
        print "passing " + str(html)
