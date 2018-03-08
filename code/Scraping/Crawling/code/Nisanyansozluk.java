package Websites;

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
		String link = "http://www.nisanyansozluk.com/?k=";
		String currentWord = "aba";
		String follow = "&view=annotated";
		boolean hasMoreWords = true;
		Elements links = null;
		Elements linksInCurrentWord = null;
		Elements ElementsInCurrentWord = null;
		Element currentLink = null;
		PrintWriter out = null;
		Document doc = null;
		int index = 21;
		int offset;
		int internalLinkCount;
		String original = "";
		boolean useOrig = false;
		try {
			 doc = Jsoup.parse(new URL(link + currentWord /*+ follow*/).openStream(), "ISO-8859-9", link + currentWord + follow);
		} catch (IOException e1) {
			// TODO Auto-generated catch block
			e1.printStackTrace();
		}

		while(hasMoreWords){
			index = 21;
			try {
				
				links = doc.select("a[href]");
				if(useOrig)
				{
					currentWord = original;
					useOrig = false;
				}
				currentLink = doc.getElementsByAttributeValue("title",currentWord).get(0);
				Element E = currentLink.parent();
				ElementsInCurrentWord = currentLink.parent().children();
				linksInCurrentWord = ElementsInCurrentWord.select("a");
				
				//writing html to file
				out = new PrintWriter(currentWord + ".html");
				String e = ElementsInCurrentWord.html(); 
				out.write(e);
				out.close();

			} catch (Exception e2) {
				// TODO Auto-generated catch block
				e2.printStackTrace();
			}


			//Calculating if has more words
			if(currentWord.compareTo("zürriyet") == 0)
				hasMoreWords = false;
			else
			{		
				internalLinkCount = linksInCurrentWord.size();
				offset = 0;
				
				do
				{
					offset = index + internalLinkCount;
					currentWord = links.get(offset).text();
					//Editing the name, getting rid of problematic character
					int charIndex = currentWord.indexOf('|');
					if(charIndex != -1)
						currentWord = currentWord.substring(0, charIndex) + '-';
					if(currentWord.contains("(o)+"))
					{
						int i = currentWord.indexOf('(');
						original = currentWord;
						currentWord = currentWord.substring(0,i) + "%28o%29%2B";
						useOrig = true;
					}
					if(currentWord.contains("+"))
					{
						original = currentWord;
						currentWord = currentWord.replace("+", "%2B");
						useOrig = true;
					}

					try {

						doc = Jsoup.parse(new URL(link + currentWord + follow).openStream(), "ISO-8859-9", link + currentWord + follow);
					} catch (IOException e) {
						// TODO Auto-generated catch block
						e.printStackTrace();
					}

					index++;
					
				}while(doc.select("a[href]").size()< 25);
				
				//System.out.println("Done");
			}
		}
	}
}
