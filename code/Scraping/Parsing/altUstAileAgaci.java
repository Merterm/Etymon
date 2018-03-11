package Scraping.Parsing;

import java.io.BufferedReader;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.IOException;
import java.util.ArrayList;

public class altUstAileAgaci {

	@SuppressWarnings("resource")
	public static void main(String[] args) throws IOException {	//this won't be a main function in the future!
		//Properties
		BufferedReader br = null;
		String input = "closet"; 	//Get this as input in final version
		ArrayList<String> lines = new ArrayList();
	    br = new BufferedReader(new FileReader("W:\\Etymon\\data\\etymwn.tsv"));	//Change it on your computer
	
		 
		 String currLine = br.readLine();
		 while(currLine != null)
		 {
			 if(currLine.contains(input))
				 lines.add(currLine);
			 
			 currLine = br.readLine();
		 }
		 for(int i = 0; i < lines.size();i++)
			 System.out.println(lines.get(i));
	}

}
