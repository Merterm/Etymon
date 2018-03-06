import xml.etree.ElementTree as ET
import unicodecsv as csv

#Open a csv file to write all words and pronunciations
with open('word_pronunciations.csv', 'wb') as csvfile:
    csvwriter = csv.writer(csvfile, delimiter=';')
    csvwriter.writerow(['word','pronunciation'])
    #Iteratively go over the huge XML file
    for tuples in ET.iterparse('enwiktionary-20171220-pages-articles.xml'):
        #For each element in the XML file search for title and text
        for myText in tuples[1].iter('{http://www.mediawiki.org/xml/export-0.10/}page'):
            try:
                title = myText.find('{http://www.mediawiki.org/xml/export-0.10/}title').text
                #print title
                revision = myText.find('{http://www.mediawiki.org/xml/export-0.10/}revision')
                text = revision.find('{http://www.mediawiki.org/xml/export-0.10/}text').text
                #Find the Pronunciation section in text
                pronun_loc = text.find('===Pronunciation===')
                #print pronun_loc + 20
                if pronun_loc != -1:
                    #print 'inside if'
                    next_section_loc = text.find('===',pronun_loc+20)
                    #print next_section_loc
                    pronun = text[pronun_loc+20 : next_section_loc]
                    print title
                    print pronun
                    #title=[s.encode('utf-8') for s in title]
                    #pronun=[s.encode('utf-8') for s in pronun]
                    csvwriter.writerow([title, pronun])
            except:
                print "Oops!  Passing this entry."
