package Scraping.Parsing;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.Writer;

public class EtymonlineParserParser {

	public static void main(String[] args) throws Exception{
		// TODO Auto-generated method stub
		BufferedReader BR = new BufferedReader(new InputStreamReader(new FileInputStream ("W:\\Etymon\\code\\Scraping\\Parsing\\extracted_etymonline.csv"), "UTF-8" ));
		File outFile = new File("W:\\Etymon\\code\\Scraping\\Parsing\\etymonline.tsv");
		Writer W = new BufferedWriter(new OutputStreamWriter(new FileOutputStream(outFile), "UTF8"));

		String line = BR.readLine();
		line = BR.readLine();//to get rid of meaningless lines

		while(line != null)
		{
			if( !line.contains("\"none") && !line.contains("blockquote")&& !line.contains("  ") && line.contains(";") && line.charAt(0) != '<' && line.length() > 12)
			{
				String prevWord;
				String nextWord;
				String prevLan;
				int prevIndex;
				int nextIndex;
				int tabIndex;
				int lastSemicolon;
				//System.out.println(line);
				prevIndex = 0;
				nextIndex = line.indexOf("\";");
				lastSemicolon = line.lastIndexOf(";");
				prevWord = line.substring(prevIndex, nextIndex);
				String etyRelated = line.substring(lastSemicolon + 1);
				String etyType = line.substring(nextIndex + 2, nextIndex + 6);
				line = line.substring(0, lastSemicolon);


				switch (etyType)
				{
				case "comb":
					line = line.substring(nextIndex + 7);
					String firstComb = line.substring(0,line.indexOf("##"));
					String secondComb = line.substring(line.indexOf("##") + 2,line.indexOf("\t"));
					W.append("eng: " + prevWord + "\trel:etymology\teng: " + firstComb + '\n');
					W.append("eng: " + prevWord + "\trel:etymology\teng: " + secondComb + '\n');
					W.flush();
					break;
				case "sing":
					line = line.substring(nextIndex + 9);
					nextWord = line.substring(0, line.indexOf('\t'));
					W.append("eng: " + prevWord + "\trel:etymology\teng: " + nextWord + '\n');
					W.flush();
					break;
				case "orig":
				case "\"ori":
					if(/*!line.contains("\"orig") &&*/ !(line.contains("<span")|| line.contains("<a class") || line.contains("<p>") ))
					{
						
						tabIndex = line.indexOf('\t');
						line = line.substring(tabIndex + 1);
						
						while(line.length() > 2)
						{
							tabIndex = line.indexOf('\t');
							prevLan = line.substring(0, line.indexOf("##"));
							nextWord = line.substring(line.indexOf("##") + 2, tabIndex);
							W.append("eng: " + prevWord + "\trel:etymology\t" + prevLan + ": " + nextWord + '\n');
							W.flush();
							line = line.substring(tabIndex + 1);
						}

					}
				default:
					while(etyRelated.length() > 2)
					{
						W.append("eng: " + prevWord + "\trel:etymologically_related\teng: ");
						tabIndex = etyRelated.indexOf('\t');
						nextWord = etyRelated.substring(0,tabIndex);
						W.append(nextWord + '\n');
						W.flush();
						etyRelated = etyRelated.substring(tabIndex + 1);
					}
					break;
				}

				
			}
			line = BR.readLine();
		}
		W.close();
		BR.close();
	}
}


