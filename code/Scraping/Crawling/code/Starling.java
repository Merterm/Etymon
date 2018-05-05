package Scraping.Crawling.code;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.PrintWriter;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

public class Starling {
	
	static String Starling = "http://starling.rinet.ru";
	static String mainFollow = "/cgi-bin/main.cgi?root=config&morpho=0";
	public static void main(String[] args) {
		//Properties
		Elements links = null;
		PrintWriter out = null;
		
		
		//Code
		try {
			links = Jsoup.connect(Starling + mainFollow ).get().select("a[href*=response]");
		} catch (Exception e2) {
			// TODO Auto-generated catch block
			e2.printStackTrace();
		}
		
		String languageName = "";
		for(int index = 0; index < 95; index ++)
		{
			System.out.println("Inside for");
			Element currentLink = links.get(index);
			String currentLinkAddr = currentLink.attributes().get("href");
			Element tempo = currentLink.parent().parent();
			languageName = tempo.select("b").text();
			String projectPath = "W:\\Etymon\\data\\starling\\";
			System.out.println(projectPath);
			new File( projectPath + languageName).mkdir();
			
			
			currentLinkAddr = currentLinkAddr.substring(0,currentLinkAddr.length()-1);
			boolean hasMorePages = true;
			int pageNo = 1;
			Document document = null;
			String html = "";
			while(hasMorePages)
			{
				//System.out.println("Inside while");
				
				try {
					out = new PrintWriter(projectPath + languageName + "/" + languageName + "_Query result" + pageNo + ".html");
					document = Jsoup.connect(Starling + currentLinkAddr + pageNo).get();
					html = document.html();
					
					out.write(html);
				} catch (Exception e) {
					// TODO Auto-generated catch block
					e.printStackTrace();
				}
				out.close();
				//Checking if there are more pages
				
				if(!html.contains("<br>Forward:"))
					hasMorePages = false;
				else
					pageNo = pageNo + 20;
			}
			System.out.println("Done");
			
		}
		
		System.out.println("Done");

	}

}
