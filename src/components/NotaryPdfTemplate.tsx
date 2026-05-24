import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';

// Register standard fonts
Font.register({
  family: 'Times-Roman',
  fonts: [
    { src: 'Times-Roman' },
    { src: 'Times-Bold', fontWeight: 'bold' }
  ]
});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Times-Roman',
    backgroundColor: '#ffffff'
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  logo: {
    width: 80,
    height: 80
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10
  },
  headerName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 2
  },
  headerCredentials: {
    fontSize: 10,
    alignSelf: 'flex-end',
    marginBottom: 4,
    marginRight: 20
  },
  headerRedText: {
    color: '#b30000',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
    textTransform: 'uppercase'
  },
  headerContact: {
    fontSize: 10,
    textAlign: 'center',
    marginBottom: 2
  },
  headerAddress: {
    fontSize: 8,
    textAlign: 'center'
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 5,
    fontSize: 11
  },
  metaText: {
    fontSize: 11,
    marginBottom: 5
  },
  bold: {
    fontWeight: 'bold'
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    marginVertical: 8
  },
  personRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10
  },
  personLeft: {
    flex: 1,
    paddingRight: 10
  },
  personText: {
    fontSize: 11,
    lineHeight: 1.3,
    marginBottom: 10
  },
  thumbBox: {
    width: 100,
    height: 100,
    borderWidth: 1,
    borderColor: '#000000',
    backgroundColor: '#f9fafb',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 5
  },
  thumbImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    padding: 2
  },
  personRight: {
    width: 120,
    alignItems: 'center',
    paddingLeft: 10
  },
  photoBox: {
    width: 100,
    height: 100,
    borderWidth: 1,
    borderColor: '#000000',
    backgroundColor: '#f9fafb',
    justifyContent: 'center',
    alignItems: 'center'
  },
  photoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  signatureLine: {
    width: 100,
    borderTopWidth: 1,
    borderTopColor: '#000000',
    marginTop: 40,
    paddingTop: 5,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: 'bold'
  },
  footerText: {
    fontSize: 11,
    lineHeight: 1.5,
    marginTop: 10
  },
  notaryStamps: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 50
  },
  stampBox: {
    alignItems: 'center'
  },
  stampTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1
  },
  stampSub: {
    fontSize: 11,
    fontWeight: 'bold'
  },
  pageNumber: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 10,
    color: '#666666'
  }
});

interface Person {
  id: string;
  name: string;
  age: string;
  aadhar: string;
  pan?: string;
  addr: string;
  phone?: string;
  email?: string;
  photo: string | null;
  thumb: string | null;
}

interface NotaryPdfTemplateProps {
  persons: Person[];
  srNo: string;
  kNo: string;
  pageNo: string;
  docDate: string;
  docName: string;
  docPurpose: string;
  finalDocumentPageCount: number; // Renamed and now represents the final total pages
}

const NotaryPdfTemplate: React.FC<NotaryPdfTemplateProps> = ({
  persons,
  srNo,
  kNo,
  pageNo,
  docDate,
  docName,
  docPurpose,
  finalDocumentPageCount // Use the new prop
}) => {
  // Compute pagination chunks
  const chunks: Person[][] = [];
  const intermediateLimit = persons.filter(p => p.email && p.phone).length > 3 ? 3 : 4;
  
  if (persons.length > 0) {
    let i = 0;
    while (i < persons.length) {
      if (i === 0) {
        chunks.push(persons.slice(i, i + 3));
        i += 3;
      } else {
        chunks.push(persons.slice(i, i + intermediateLimit));
        i += intermediateLimit;
      }
    }
  } else {
    chunks.push([]);
  }

  // Generate public asset URLs. Note: In vite, public files can be referenced natively or via import.
  // For react-pdf we must pass an absolute URL or valid path if it's node/browser. 
  // Normally passing relative paths works if hosted.
  const assetUrl = (filename: string) => new URL(`${import.meta.env.BASE_URL}${filename}`, window.location.href).toString();
  const logo1Src = assetUrl('1_low.jpg');
  const logo2Src = assetUrl('3_low.jpg');
  const logo3Src = assetUrl('2_low.jpg');

  const getSafeImageUrl = (url?: string | null) => {
    if (!url) return undefined;
    if (url.startsWith('data:image')) return url;
    
    // Auto-compress cloudinary URLs
    if (url.includes('res.cloudinary.com')) {
      const parts = url.split('/upload/');
      if (parts.length === 2 && !url.includes('q_auto')) {
        // Remove any existing transformations by finding the first slash after upload
        const pathPart = parts[1].includes('/') && parts[1].split('/')[0].includes(',') 
          ? parts[1].substring(parts[1].indexOf('/') + 1) 
          : parts[1];
        url = `${parts[0]}/upload/w_200,q_10,f_jpg/${pathPart}`;
      }
    }
    
    return `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  };

  return (
    <Document>
      {chunks.map((chunk, pageIndex) => {
        const isFirstPage = pageIndex === 0;
        const isLastPage = pageIndex === chunks.length - 1;

        return (
          <Page key={pageIndex} size="A4" style={styles.page}>
            <Image 
              src={logo3Src}
              style={{ position: 'absolute', top: '27.5%', left: '20%', width: '60%', height: '45%', opacity: 0.05, objectFit: 'contain' }} 
              quality={0.3}
            />
            {isFirstPage && (
              <View>
                <View style={styles.headerRow}>
                  <Image src={logo1Src} style={styles.logo} quality={0.3} />
                  <View style={styles.headerCenter}>
                    <Text style={styles.headerName}>Mr. Sameer Shrikant Vispute</Text>
                    <Text style={styles.headerCredentials}>BLS., LLB., DIPL</Text>
                    <Text style={{ fontWeight: 'bold', fontSize: 14, marginBottom: 2 }}>
                      Advocate High Court
                    </Text>
                    <Text style={styles.headerRedText}>
                      Notary (Govt. of India){'\n'}Reg. No. 57704
                    </Text>
                    <Text style={styles.headerContact}>
                      Mob. 8286000888 / 9933806888 | Email - advsameervispute@gmail.com
                    </Text>
                    <Text style={styles.headerAddress}>
                      Shree Bhagwati Krupa, Pendse Nagar, Lane No 2, Dombivli (E), Dist. Thane - 421201.
                    </Text>
                    <Text style={styles.headerAddress}>
                      A002 Om Residency, Khambalpada, Off 90 Feet Road, Thakurli, Dombivli (E), Dist. Thane - 421201
                    </Text>
                  </View>
                  <Image src={logo2Src} style={styles.logo} quality={0.3} />
                </View>

                <View style={styles.metaRow}>
                  <Text>Sr No: <Text style={styles.bold}>{srNo}</Text></Text>
                  <Text>Date: <Text style={styles.bold}>{docDate}</Text></Text>
                </View>
                <Text style={styles.metaText}>Register No - <Text style={styles.bold}>{kNo}</Text></Text>
                <Text style={styles.metaText}>Reg.Page No - <Text style={styles.bold}>{pageNo}</Text></Text>

                <View style={styles.divider} />
              </View>
            )}

            <View style={{ flexGrow: 1 }}>
              {chunk.map((person) => (
                <View key={person.id}>
                  <View style={styles.personRow}>
                    <View style={styles.personLeft}>
                      <Text style={styles.personText}>
                        I Mr <Text style={styles.bold}>{person.name}</Text> aged <Text style={styles.bold}>{person.age}</Text> yrs.{'\n'}
                        Residing at <Text style={styles.bold}>{person.addr}</Text>{'\n'}
                        {person.aadhar && <Text>Aadhar Card No: <Text style={styles.bold}>{person.aadhar}</Text></Text>}
                        {person.aadhar && person.pan && <Text> | </Text>}
                        {person.pan && <Text>PAN Card No: <Text style={styles.bold}>{person.pan.toUpperCase()}</Text></Text>}
                        {person.phone && <Text>{'\n'}Phone: <Text style={styles.bold}>{person.phone}</Text></Text>}
                        {person.email && <Text>{'\n'}Email: <Text style={styles.bold}>{person.email}</Text></Text>}
                      </Text>

                      <View style={styles.thumbBox}>
                        {person.thumb && <Image src={getSafeImageUrl(person.thumb)} style={styles.thumbImg} quality={0.3} />}
                      </View>
                    </View>

                    <View style={styles.personRight}>
                      <View style={styles.photoBox}>
                        {person.photo && <Image src={getSafeImageUrl(person.photo)} style={styles.photoImg} quality={0.3} />}
                      </View>
                      <Text style={styles.signatureLine}>Signature</Text>
                    </View>
                  </View>
                  <View style={styles.divider} />
                </View>
              ))}

              {isLastPage && (
                <View>
                  <Text style={styles.footerText}>
                    That I/we have executed the annexed <Text style={styles.bold}>{docName || 'Gift Deed'}</Text> dated <Text style={styles.bold}>{docDate || '26th April 2026'}</Text>, pertaining to the {docPurpose || '___'} purposes.{'\n'}
                    I/we state that I/we have signed and given left hand digital thumb in the said document beside our respective photographs appearing hereinabove, and that the said <Text style={styles.bold}>{docName || 'Gift Deed'}</Text> consists of {finalDocumentPageCount} pages.
                  </Text>
                  <View style={styles.divider} />
                </View>
              )}
            </View>



            <Text
              style={styles.pageNumber}
              render={({ pageNumber }) => `Page ${pageNumber} of ${chunks.length}`}
              fixed
            />
          </Page>
        );
      })}
    </Document>
  );
};

export default NotaryPdfTemplate;
