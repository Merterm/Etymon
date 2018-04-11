import unicodecsv as csv
import os
import re

#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
# Author: Mert Inan
# Date: 23/02/2018 -
# Description:  This code opens the csv file that contains etymologies from the
#               website nisanyansozluk.com called nisanyan_etymologies.csv, then
#               using regular expressions extracts the origin language and origin
#               words. If the word is a combination of multiple words, then those
#               words are extracted. If the word is in another tense of Another
#               word, then that word is extracted. If the regular expression can
#               not find anything then the original text is rewritten.
#               Output:
#               extracted_etymonline.csv file
#               Labels:
#               - u'orig' : used for successful extraction of origin language and
#                           words.
#               - u'comb': used for successful extraction of combination words.
#               - u'single': used for successful extraction of a tensed word.
#               - u'none': used for unsuccessful extraction.
# Version: 1.0
# Changes:
#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%


#Create a csv file to store the new extracted etymologies
csvfile = open('extracted_nisanyan.csv', 'wb')
csvwriter = csv.writer(csvfile, delimiter=';')
csvwriter.writerow(['word','etymology','related'])
csvfile.close()

 #"<section class=\"word__defination--2q7ZH\"><object><p></p><p>1943; see <a class=\"crossreference\" href=\"/word/lobotomy?ref=etymonline_crossreference\">lobotomy</a> + <a class=\"crossreference\" href=\"/word/-ize?ref=etymonline_crossreference\">-ize</a>. Related: <span class=\"foreign\">Lobotomized</span>.</p><p></p></object></section>", re.M)

#Open the etymonline csv file
csvfile = open('nisanyan_etymologies.csv', 'rb')
etymon_reader = csv.reader(csvfile, delimiter=';')
etymon_reader.next()

comb_cnt = 0
row_cnt = 0
single_cnt = 0
none_cnt = 0
orig_cnt = 0

#Loop over the csv file and match a regular expression then write them to extracted
for row in etymon_reader:
    row_cnt = row_cnt + 1
    #try:
    #Regular Expression
    etymology_extract = re.findall(ur"<b>(.+?)</b>.*?<i>(.+?)</i>", row[1], re.M | re.UNICODE)
    # <span style=\"visibility:hidden;font-size:0px\">z</span>"
    #combination_extract = re.findall(r"class=\"crossreference\".*?>(.+?)</a>.*?\+.*?<a .*?class=\"crossreference\".*?>(.+?)</a>", row[1], re.M)
    #single_extract = re.findall(r"class=\"crossreference\".*?>(.+?)</a>",row[1],re.M)
    related_extract = "" #re.findall(r"<li class=\"related__word--3Si0N\">(.+)</li>",row[2])

    #If no etymological root is present in the text, check whether it is a
    # combination word or a tensed version of another word
    if etymology_extract:
        etymology_extract = ['orig'] + etymology_extract #label found origins
        orig_cnt = orig_cnt + 1
    #elif (not etymology_extract) and combination_extract:
    #    etymology_extract = [u'comb'] + combination_extract #combinations are labeled
    #    comb_cnt = comb_cnt + 1
    #elif (not etymology_extract) and (not combination_extract) and single_extract:
    #    etymology_extract = [u'single'] + single_extract #singles are labeled
    #    single_cnt = single_cnt + 1
    elif (not etymology_extract): # and (not combination_extract) and (not single_extract):
        etymology_extract = ['none'] + [row[1]] #nothing is extracted
        none_cnt = none_cnt + 1

    #Write-back
    csvfile = open('extracted_nisanyan.csv', 'ab')
    csvwriter = csv.writer(csvfile, delimiter=';')
    csvwriter.writerow([row[0], etymology_extract, related_extract])
    csvfile.close()
    #except:
        #pass
print "Total word count: \t" + str(row_cnt)
print "Origin count: \t\t" + str(orig_cnt)
print "Combination count: \t" + str(comb_cnt)
print "Single count: \t\t" + str(single_cnt)
print "Unsuccessful count: \t" + str(none_cnt)
csvfile.close()
