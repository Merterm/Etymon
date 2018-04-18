package Scraping.Parsing;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.io.UnsupportedEncodingException;
import java.io.Writer;
import java.nio.charset.StandardCharsets;

public class nisanyanParserParser {

	public static void main(String[] args) throws Exception {
		// TODO Auto-generated method stub
		BufferedReader BR = new BufferedReader(new InputStreamReader(new FileInputStream ("W:\\Etymon\\code\\Scraping\\Parsing\\extracted_nisanyan.csv"), "UTF-8" ));
		File outFile = new File("W:\\Etymon\\code\\Scraping\\Parsing\\Nisanyan.tsv");
		//PrintWriter PW = new PrintWriter(new OutputStreamWriter(new FileOutputStream(outFile),StandardCharsets.UTF_8),true);
		Writer PW = new BufferedWriter(new OutputStreamWriter(
				new FileOutputStream(outFile), "UTF8"));
		
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
				if(prevWord.contains("|") )
					prevWord = prevWord.replace("|", "");
				line = line.substring(line.indexOf('\t')+1); //shortening the line
				prevLan = "tur";

				while(line.length() > 3)
				{
					String newLine = "";
					newLine = newLine.concat(prevLan + ": ");
					newLine = newLine.concat(prevWord + '\t');
					newLine = newLine.concat("rel: etymology" + '\t');
					prevIndex = 0;
					comaIndex = line.indexOf(',');
					nextIndex = line.indexOf("\t");
					prevLan = line.substring(prevIndex, comaIndex);
					
					boolean lanDefined = false;
					switch(prevLan)
					{
					case "Fransızca ":
						prevLan = "fre";
						lanDefined = true; 
						break;
					case "Arapça":
						prevLan = "ara";
						lanDefined = true; 
						break;	
					case "Türkçe":
						prevLan = "tur";
						lanDefined = true; 
						break;
					case "Latince":
						prevLan = "lat";
						lanDefined = true; 
						break;
					case "Farsça":
						prevLan = "per";
						lanDefined = true; 
						break;
					case "İngilizce ":
						prevLan = "eng";
						lanDefined = true; 
						break;
					case "İspanyolca ":
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
					case "İtalyanca":
						prevLan = "ita";
						lanDefined = true; 
						break;
					case "Yeni Yunanca":
						prevLan = "gre";
						lanDefined = true; 
						break;
					case "Moğolca ":
						prevLan = "mon";
						lanDefined = true; 
						break;
					case "Rusça ":
						prevLan = "rus";
						lanDefined = true; 
						break;
					case "İbranice ":
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
					case "Akatça":
						prevLan = "akk";
						lanDefined = true; 
						break;
					case "Fransızca ve İngilizce ":
						prevLan = "fre/eng";
						lanDefined = true; 
						break;
					case "Venedikçe":
						prevLan = "vec";
						lanDefined = true; 
						break;
					default:
						if(prevLan.compareTo("tur") != 0 && !lanDefined )
							System.out.println(prevLan);
						break;
					}
					newLine = newLine.concat(prevLan + ": ");
					nextWord = line.substring(comaIndex + 1, nextIndex);
					if(nextWord.contains("|") )
						nextWord = nextWord.replace("|", "");
					newLine = newLine.concat(nextWord + '\n');

					line = line.substring(nextIndex+1);
					prevWord = nextWord;
					PW.append(newLine);
					PW.flush();
				}


			}
			line = BR.readLine();
		}
		BR.close();
		PW.close();

	}

}
