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
			if(!line.contains("none"))
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
				line = line.substring(line.indexOf(',')+1);
				prevLan = "tur";
				
				while(line.length() > 3)
				{
					String newLine = "";
					newLine = newLine.concat(prevLan + ": ");
					newLine = newLine.concat(prevWord + '\t');
					newLine = newLine.concat("rel: etymology" + '\t');
					prevIndex = line.indexOf('\'') + 1;
					comaIndex = line.indexOf(',');
					nextIndex = line.indexOf("\')");
					prevLan = line.substring(prevIndex, comaIndex-1);
					newLine = newLine.concat(prevLan + ": ");
					if(line.charAt(comaIndex + 3) == '\'' )
						nextWord = line.substring(comaIndex + 4, nextIndex);
					else
					{
						nextIndex = line.indexOf("\")");
						nextWord = line.substring(comaIndex + 5, nextIndex-1);
					}
					newLine = newLine.concat(nextWord + '\n');
					
					line = line.substring(nextIndex+3);
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
