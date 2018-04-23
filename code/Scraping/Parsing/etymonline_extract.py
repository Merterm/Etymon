import unicodecsv as csv
import os
import re

#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
# Author: Mert Inan
# Date: 23/02/2018 -
# Description:  This code opens the csv file that contains etymologies from the
#               website Etymonline.com called extracted_etymonline.csv, then
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
orig_cnt = 0

#Loop over the csv file and match a regular expression then write them to extracted
for row in etymon_reader:
    row_cnt = row_cnt + 1
    #try:
    #Regular Expression
    etymology_extract = ""
    single_extract = ""
    combination_extract = ""
    related_extract = ""

    etymology_found = re.findall(ur"[Ff]rom (.+?) *<span class=\"foreign\">(.+?)</span>", row[1], re.M | re.UNICODE)
    for idx in range(len(etymology_found)):
        lang = etymology_found[idx][0].encode('utf-8')
        orig_word = etymology_found[idx][1].encode('utf-8')
        etymology_extract = etymology_extract + lang + "##" + orig_word + "\t"
    combination_found = re.findall(ur"class=\"crossreference\".*?>(.+?)</a>.*?\+.*?<a .*?class=\"crossreference\".*?>(.+?)</a>", row[1], re.M | re.UNICODE)
    for idx in range(len(combination_found)):
        comb1 = combination_found[idx][0].encode('utf-8')
        comb2= combination_found[idx][1].encode('utf-8')
        combination_extract = combination_extract + comb1 + "##" + comb2 + "\t"
    single_found = re.findall(ur"class=\"crossreference\".*?>(.+?)</a>",row[1],re.M | re.UNICODE)
    for idx in range(len(single_found)):
        single = single_found[idx].encode('utf-8')
        single_extract = single_extract + single + "\t"
    related_found = re.findall(ur"<li class=\"related__word--3Si0N\">(.+)</li>",row[2])
    for idx in range(len(related_found)):
        related = related_found[idx].encode('utf-8')
        related_extract = related_extract + related + "\t"

    #If no etymological root is present in the text, check whether it is a
    # combination word or a tensed version of another word
    if etymology_extract:
        etymology_extract = "orig\t" + etymology_extract #label found origins
        orig_cnt = orig_cnt + 1
    elif (not etymology_extract) and combination_extract:
        etymology_extract = "comb\t" + combination_extract #combinations are labeled
        comb_cnt = comb_cnt + 1
    elif (not etymology_extract) and (not combination_extract) and single_extract:
        etymology_extract = "single\t" + single_extract #singles are labeled
        single_cnt = single_cnt + 1
    elif (not etymology_extract) and (not combination_extract) and (not single_extract):
        etymology_extract = "none\t" + row[1] #nothing is extracted
        none_cnt = none_cnt + 1

    #Write-back
    csvfile = open('extracted_etymonline.csv', 'ab')
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
