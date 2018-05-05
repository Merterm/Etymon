package Scraping.Parsing;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.Writer;

public class StarlingParserParser {

	public static void main(String[] args)throws Exception {
		// TODO Auto-generated method stub
		String etyRel1 = "rel:etymology\t";
		String etyRel2 = "rel:etymological_origin_of\t";
		//String etyRel3 = "rel:etymologically_related\t";
		String path = "W:\\Etymon\\data\\starling\\";
		String lanName = args[0] + " etymology";
		int no = 1;

		File outFile = new File("W:\\Etymon\\code\\Scraping\\Parsing\\" + lanName + ".tsv");
		Writer PW = new BufferedWriter(new OutputStreamWriter(new FileOutputStream(outFile), "UTF8"));
		boolean cont = true;

		while(cont)
		{
			try{
				BufferedReader BR = new BufferedReader(new InputStreamReader(new FileInputStream (path + lanName + "\\" + lanName + "_Query result" + no +".html"), "UTF-8" ));
				//boolean cont2 = true;

				String temp = BR.readLine();
				while(temp != null)
				{
					String fWordLan;
					String fWord;
					String sWord;
					String sWordLan;
					if(temp.contains("<span class=\"fld\"><font color=\"green\">"))
					{
						fWordLan = temp.substring(42, temp.indexOf("</"));
						temp = BR.readLine();
						fWord = temp.substring(26, temp.indexOf("</"));
						BR.readLine();
						BR.readLine();
						BR.readLine();
						temp = BR.readLine();
						while(!temp.contains("<!-- results_record_end -->"))
						{
							if(temp.contains("<span class=\"fld\">") && !temp.contains("Meaning") && !temp.contains("meaning") && !temp.contains("Comments"))
							{
								sWordLan = temp.substring(22, temp.indexOf("</"));
								temp = BR.readLine();
								sWord = temp.substring(26, temp.indexOf("</"));
								if(sWord.contains(" "))
									sWord = sWord.substring(0, sWord.indexOf(" "));
								if(sWord.contains("<i>"))
									sWord = sWord.replace("<i>", "");
								if(sWord.contains(","))
									sWord = sWord.substring(0, sWord.indexOf(','));

								fWord = fWord.replaceAll("[0-9]", "");
								sWord = sWord.replaceAll("[0-9]", "");
								if(fWord.contains(" "))
									fWord = fWord.substring(0, fWord.indexOf(' '));
								if(fWord.contains(","))
									fWord = fWord.substring(0, fWord.indexOf(','));


								PW.append(fWordLan);
								PW.append(" " + fWord + '\t');
								PW.append(etyRel2);
								PW.append(sWordLan);
								PW.append(" " + sWord + '\n');

								PW.append(sWordLan);
								PW.append(" " + sWord + '\t');
								PW.append(etyRel1);
								PW.append(fWordLan);
								PW.append(" " + fWord + '\n');

							}
							temp = BR.readLine();
						}

					}
					temp = BR.readLine();
				}
			}catch(Exception e){
				cont = false;
			}
			no = no + 20;
		}
		PW.close();
	}

}
