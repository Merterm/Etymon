import unicodecsv as csv
import os
import re

#Create a csv file to store the new extracted etymologies
csvfile = open('extracted_etymonline.csv', 'wb')
csvwriter = csv.writer(csvfile, delimiter=';')
csvwriter.writerow(['word','etymology','related'])
csvfile.close()

 #"<section class=\"word__defination--2q7ZH\"><object><p></p><p>1943; see <a class=\"crossreference\" href=\"/word/lobotomy?ref=etymonline_crossreference\">lobotomy</a> + <a class=\"crossreference\" href=\"/word/-ize?ref=etymonline_crossreference\">-ize</a>. Related: <span class=\"foreign\">Lobotomized</span>.</p><p></p></object></section>", re.M)

#Open the etymonline csv file
csvfile = open('etymonline_word_etymologies.csv', 'rb')
etymon_reader = csv.reader(csvfile, delimiter=';')
etymon_reader.next()

comb_cnt = 0
row_cnt = 0
single_cnt = 0
none_cnt = 0

#Loop over the csv file and match a regular expression then write them to extracted
for row in etymon_reader:
    row_cnt = row_cnt + 1
    try:
        #Regular Expression
        etymology_extract = re.findall(r"[Ff]rom (.+?) *<span class=\"foreign\">(.+?)</span>", row[1], re.M)
        combination_extract = re.findall(r"class=\"crossreference\".*?>(.+?)</a>.*?\+.*?<a .*?class=\"crossreference\".*?>(.+?)</a>", row[1], re.M)
        single_extract = re.findall(r"class=\"crossreference\".*?>(.+?)</a>",row[1],re.M)
        related_extract = re.findall(r"<li class=\"related__word--3Si0N\">(.+)</li>",row[2])

        #If no etymological root is present in the text, check whether it is a
        # combination word or a tensed version of another word
        if etymology_extract:
            etymology_extract = [u'orig'] + etymology_extract #label found origins
        elif (not etymology_extract) and combination_extract:
            etymology_extract = [u'comb'] + combination_extract #combinations are labeled
            comb_cnt = comb_cnt + 1
        elif (not etymology_extract) and (not combination_extract) and single_extract:
            etymology_extract = [u'single'] + single_extract #singles are labeled
            single_cnt = single_cnt + 1
        elif (not etymology_extract) and (not combination_extract) and (not single_extract):
            none_cnt = none_cnt + 1

        #Write-back
        csvfile = open('extracted_etymonline.csv', 'ab')
        csvwriter = csv.writer(csvfile, delimiter=';')
        csvwriter.writerow([row[0], etymology_extract, related_extract])
        csvfile.close()
    except:
        pass

print comb_cnt
print row_cnt
print single_cnt
print none_cnt
csvfile.close()
