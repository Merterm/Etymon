package Scraping.Parsing;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.io.UnsupportedEncodingException;

public class nisanyanParserParser {

	public static void main(String[] args) throws Exception {
		// TODO Auto-generated method stub
		BufferedReader BR = new BufferedReader(new InputStreamReader(new FileInputStream ("W:\\Etymon\\code\\Scraping\\Parsing\\extracted_nisanyan.csv"), "UTF-8" ));
		PrintWriter PW = new PrintWriter(new File("W:\\Etymon\\code\\Scraping\\Parsing\\Nisanyan.tsv"));

		//Discarding the first line
		String line = BR.readLine();

		line = BR.readLine();
		while(line != null)
		{
			if(!line.contains("none") && !(line.contains("<p>")|| line.contains("<b>") || line.contains("<sup>")|| line.contains("<i>") ))
			{

				String prevWord;
				String nextWord;
				String prevLan;
				int prevIndex;
				int nextIndex;
				int comaIndex;
				//System.out.println(line);
				prevIndex = 0;
				nextIndex = line.indexOf(';');
				prevWord = line.substring(prevIndex, nextIndex);
				line = line.substring(line.indexOf('\t')+1); //shortening the line
				prevLan = "tur";

				while(line.length() > 3)
				{
					String newLine = "";
					newLine = newLine.concat(prevLan + ": ");
					newLine = newLine.concat(prevWord + '\t');
					newLine = newLine.concat("rel: etymology" + '\t');
					prevIndex = 0;//line.indexOf('\t'') + 1;
					comaIndex = line.indexOf(',');
					nextIndex = line.indexOf("\t");
					prevLan = line.substring(prevIndex, comaIndex);
					
					boolean lanDefined = false;
					switch(prevLan)
					{
					case "Frans�zca ":
						prevLan = "fre";
						lanDefined = true; 
						break;
					case "Arap�a":
						prevLan = "ara";
						lanDefined = true; 
						break;	
					case "T�rk�e":
						prevLan = "tur";
						lanDefined = true; 
						break;
					case "Latince":
						prevLan = "lat";
						lanDefined = true; 
						break;
					case "Fars�a":
						prevLan = "per";
						lanDefined = true; 
						break;
					case "�ngilizce ":
						prevLan = "eng";
						lanDefined = true; 
						break;
					case "�spanyolca ":
						prevLan = "spa";
						lanDefined = true; 
						break;
					case "Eski Yunanca":
						prevLan = "grc";
						lanDefined = true; 
						break;
					case "Almanca ":
						prevLan = "ger";
						lanDefined = true; 
						break;
					case "�talyanca":
						prevLan = "ita";
						lanDefined = true; 
						break;
					case "Yeni Yunanca":
						prevLan = "gre";
						lanDefined = true; 
						break;
					case "Mo�olca ":
						prevLan = "mon";
						lanDefined = true; 
						break;
					case "Rus�a ":
						prevLan = "rus";
						lanDefined = true; 
						break;
					case "�branice ":
						prevLan = "heb";
						lanDefined = true; 
						break;
					case "Ermenice":
						prevLan = "arm";
						lanDefined = true; 
						break;
					case "Eski Fars�a ":
						prevLan = "peo";
						lanDefined = true; 
						break;
					case "Akat�a":
						prevLan = "akk";
						lanDefined = true; 
						break;
					case "Frans�zca ve �ngilizce ":
						prevLan = "fre/eng";
						lanDefined = true; 
						break;
					case "Venedik�e":
						prevLan = "vec";
						lanDefined = true; 
						break;
					default:
						if(prevLan.compareTo("tur") != 0 && !lanDefined )
							System.out.println(prevLan);
						break;
					}
					newLine = newLine.concat(prevLan + ": ");
//					if(line.charAt(comaIndex + 3) == '\'' )
//						nextWord = line.substring(comaIndex + 4, nextIndex);
//					else
//					{
						//nextIndex = line.indexOf("\")");
						nextWord = line.substring(comaIndex + 1, nextIndex);
					//}
					newLine = newLine.concat(nextWord + '\n');

					line = line.substring(nextIndex+1);
					prevWord = nextWord;
					PW.write(newLine);
				}


			}
			line = BR.readLine();
		}
		BR.close();
		PW.close();

	}

}
