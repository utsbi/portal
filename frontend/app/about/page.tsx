"use client";

export default function AboutPage() {
  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">About Me</h1>

      <p className="mb-6">
        Hi, I’m <strong>Vishnu</strong>, a second year <strong>Informatics</strong> student at UT Austin.
        I’m interested in <strong>data science</strong>, <strong>technology</strong>, and <strong>design</strong>.
      </p>
      <p className="mb-6">
        Outside of school, my <strong>interests</strong> walking my dog, hiking, and going on bike rides.  In general I love the outdoors and road trips. 
      </p>
      <p className="mb-6">
        My <strong>future goals</strong> for myself are getting a career in data science or data analytics.  Because of my love for stats, I want to get into data visualization and understand trends.
      </p>


      

      <h2 className="text-3xl font-semibold mt-8 mb-4">Pictures Relating to Me</h2>
      <a href="https://link1.com" target="_blank">
          <img src="/images/about/img4.jpeg" alt="First" className="w-auto h-56 rounded mx-auto block" />
          <p className="text-center mt-1 text-2xl font-semibold">Vishnu Nalam Kandan</p>
          <p className="text-center mt-1">Informatics Student</p>
        </a>
      <a href="mailto:vishnu@utexas.edu"
        className="mx-auto mt-3 block w-fit bg-blue-600 text-white px-4 py-2 rounded hover:bg-b">
          
        Email Me
      </a>  
        <div className="text-center mb-8"></div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <a href="https://link1.com" target="_blank">
          <img src="/images/about/img1.jpg" alt="First" className="w-full h-auto rounded" />
          <p className="text-center mt-1">The field I'm interested in</p>
        </a>
        <a href="https://link2.com" target="_blank">
          <img src="/images/about/img2.jpg" alt="Second" className="w-full h-auto rounded" />
          <p className="text-center mt-1">My favorite animal</p>
        </a>
        <a href="https://link3.com" target="_blank">
          <img src="/images/about/img3.jpg" alt="Third" className="w-full h-auto rounded" />
          <p className="text-center mt-1">Favorite sport</p>
        </a>
      </div>
    </main>
  )
}