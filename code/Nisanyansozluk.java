//package Websites;

import java.io.PrintWriter;

import org.jsoup.Jsoup;
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
		
		while(hasMoreWords){
			
			try {
				links = Jsoup.connect(link + currentWord + follow).get().select("a[href]");
				currentLink = Jsoup.connect(link + currentWord + follow).get().getElementsByAttributeValue("title",currentWord).get(0);
				ElementsInCurrentWord = currentLink.parent().children();

				linksInCurrentWord = ElementsInCurrentWord.select("a[href]");
				//writing html to file
				out = new PrintWriter("../data/Nisanyan/" + currentWord + ".html");
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
				//get rid of trash links
				for(int i = 0; i < 16; i++)
				{
					links.remove(0);
				}
				
				int index = 0;
				boolean found = false;
				while(!found)
				{
					if(links.get(index).text().compareTo(currentLink.child(0).text()) == 0)
						found = true;
					else
						index++;
				}
				
				int internalLinkCount = linksInCurrentWord.size();
				int offset = index + internalLinkCount;
				
				currentWord = links.get(offset).ownText();
				//Editing the name, getting rid of "|" character
				int charIndex = currentWord.indexOf('|');
				if(charIndex != -1)
					currentWord = currentWord.substring(0, charIndex) + '-';
				
				System.out.println("Done");
			}
		}
	}
}
