package Scraping.Crawling.code;

import java.io.IOException;
import java.io.PrintWriter;
import java.net.URL;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Attributes;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

public class Nisanyansozluk {

	public static void main(String[] args) {


		//Properties
		String link = "http://www.nisanyansozluk.com/";
		String currentWord = "z\u00FCppe";
		String follow = "&view=annotated";
		boolean hasMoreWords = true;
		Elements links = null;
		Elements linksInCurrentWord = null;
		Elements ElementsInCurrentWord = null;
		Element currentLink = null;
		String nextLink = "?k=" + currentWord + "&lnk=1";
		PrintWriter out = null;
		Document doc = null;
		int index = 21;
		int offset;
		int internalLinkCount;
		String original = "";
		boolean useOrig = false;
		try {
			doc = Jsoup.parse(new URL("http://www.nisanyansozluk.com/?k=" + currentWord /*+ follow*/).openStream(),null /*"ISO-8859-9"*/, link + currentWord + follow);
		} catch (IOException e1) {
			// TODO Auto-generated catch block
			e1.printStackTrace();
		}

		while(hasMoreWords){

			try {

				links = doc.select("a[href]");
				index = 0;
				boolean loop = true;
				
				while(loop)
				{
					if(links.get(index).text().compareTo(currentWord) == 0)
						loop = false;
					else
						index++;
				}
				
				currentLink = doc.getElementsByAttributeValue("href",nextLink).get(0);
				//Element E = currentLink.parent();
				ElementsInCurrentWord = currentLink.parent().parent().children();
				linksInCurrentWord = ElementsInCurrentWord.select("a");
				
				//writing HTML to file
				String printName = currentWord;
				int charIndex = currentWord.indexOf('|');
				if(charIndex != -1)
					printName = currentWord.substring(0, charIndex) + '-';
				out = new PrintWriter("../../../data/Nisanyan/" + printName + ".html");
				String e = ElementsInCurrentWord.html(); 
				out.write(e);
				out.close();

			} catch (Exception e2) {
				// TODO Auto-generated catch block
				e2.printStackTrace();
			}


			//Calculating if has more words
			if(currentWord.compareTo("z�rriyet") == 0)
				hasMoreWords = false;
			else
			{		
				internalLinkCount = linksInCurrentWord.size();
				offset = 0;

				do
				{
					offset = index + internalLinkCount;
					currentWord = links.get(offset).text();
					nextLink = links.get(offset).attr("href");
					

					try {

						doc = Jsoup.parse(new URL(link + nextLink + follow).openStream(), null/*"ISO-8859-9"*/, link + nextLink + follow);
					} catch (IOException e) {
						// TODO Auto-generated catch block
						e.printStackTrace();
					}

					index++;

				}while(doc.select("a[href]").size() < 30);

				//System.out.println("Done");
			}
		}
	}
}
