package Scraping.Parsing;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.util.ArrayList;

public class altUstAileAgaci {

	public static void main(String[] args) throws IOException {	//this won't be a main function in the future!
		getRelations("etymology");
	}

	public static void getRelations(String input) throws IOException 
	{
		//Properties
		String EOO = "etymological_origin_of";
		String E = "etymology";
		String HDF = "has_derived_form";
		BufferedReader br = null;
		input = input.toLowerCase();
		ArrayList<String> parents = new ArrayList<String>();
		ArrayList<String> children = new ArrayList<String>();
		ArrayList<String> related = new ArrayList<String>();
		br = new BufferedReader(new FileReader("W:\\Downloads\\etymwn\\etymwn.tsv"));	//Change it on your computer


		String currLine = br.readLine();
		while(currLine != null)
		{
			String word = currLine.substring(currLine.indexOf(" ")+1, currLine.indexOf("\t"));
			if(word.compareTo(input) == 0)			
			{
				int position = currLine.lastIndexOf(':');
				int relPos = currLine.indexOf("rel:") + 4;
				String temp = currLine.substring(relPos);
				String relType = temp.substring(0, temp.indexOf('\t'));
				 
				
				if(relType.compareTo(E) == 0)	//Extract parents of the words			
					parents.add(currLine.substring(position+2));
				else
					if(relType.compareTo(EOO) == 0)
						children.add(currLine.substring(position+2));				
					else
						if(relType.compareTo(HDF) == 0)
							related.add(currLine.substring(position+2));
			}
			currLine = br.readLine();

		}
		br.close();
	}
}

