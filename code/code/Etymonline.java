package code;


import java.io.PrintWriter;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.select.Elements;


public class Etymonline {

	//Properties
	static String Etymonline = "https://www.etymonline.com/search?page=";
	static String atch = "&q=";
	static char[] alphabet = "abcdefghijklmnopqrstuvwxyz".toCharArray();

	public static void main(String[] args) {
		// TODO Auto-generated method stub
		Elements allWords = new Elements(); 


		for(int alphabetNo = 0; alphabetNo < 26; alphabetNo++)
		{
			
			boolean hasMorePages = true;
			int pageNo = 1;
			Elements links = null;

			while(hasMorePages){

				try {
					links = Jsoup.connect(Etymonline + pageNo + atch + alphabet[alphabetNo]).get().select("a[href*=word/]");
				} catch (Exception e2) {
					// TODO Auto-generated catch block
					e2.printStackTrace();
				}
				//add links to the big array
				for(int i = 0; i < 10; i++)
				{
					links.remove( links.last());
				}
				allWords.addAll(links);
				pageNo++;

				//Check if there are more pages
				try {
					Document document = Jsoup.connect(Etymonline + pageNo + atch + alphabet[alphabetNo]).get();
					String html = document.html();
					Document doc = Jsoup.parse(html);
					Elements msg = doc.getElementsByTag("h2");				
					if(msg.text().compareTo("No results were found for " + alphabet[alphabetNo]) == 0)
						hasMorePages = false;
				} catch (Exception e2) {
					// TODO Auto-generated catch block
					e2.printStackTrace();
				}
			}
			//FileOutputStream out = null;
			PrintWriter out = null;
			for(int i = 0; i < allWords.size(); i++)
			{
				String path = allWords.get(i).attr("href");
				String name = path.substring(6);
				
				try {
					out = new PrintWriter(name + ".html");
					//out = new FileOutputStream( name + ".html");
					
					Document document = Jsoup.connect("https://www.etymonline.com" + path).get();
					String html = document.html();
					
					out.write(html);
				} catch (Exception e) {
					// TODO Auto-generated catch block
					e.printStackTrace();
				}
				//System.out.println("Put debug to this line to test the html ");
			}
			out.close();
			allWords = new Elements();
		}
	}
}
